const express = require('express');
const bodyParser = require('body-parser');
const {sequelize} = require('./model')
const {getProfile} = require('./middleware/getProfile')
const app = express();
const { Op } = require("sequelize");
app.use(bodyParser.json());
app.set('sequelize', sequelize)
app.set('models', sequelize.models)

/**
 * FIX ME!
 * @returns contract by id
 */
app.get('/contracts/:id', getProfile, async (req, res) => {
    const {Contract} = req.app.get('models')
    const {id} = req.params
    const contract = await Contract.findOne({where: {
        id,
        [Op.or]: [
          {ContractorId: req.profile.id},
          {ClientId: req.profile.id}
        ]
        }
    })
    if(!contract) return res.status(404).end()
    res.json(contract)
})

app.get('/contracts', getProfile, async (req, res) => {
    const {Contract} = req.app.get('models')
    const contracts = await Contract.findAll({where: {
        status: {
            [Op.not]: 'terminated'
        },
        [Op.or]: [
          {ContractorId: req.profile.id},
          {ClientId: req.profile.id}
        ]
        }
    })
 
    res.json(contracts)
})

app.get('/jobs/unpaid', getProfile, async (req, res) => {
    const {Contract, Job} = req.app.get('models')
    const contracts = await Contract.findAll({where: {
        status: 'in_progress',
        [Op.or]: [
          {ContractorId: req.profile.id},
          {ClientId: req.profile.id}
        ]
        },
        include: {
            model: Job,
            where: {
                paid: null
            }
        }
    })
 
    res.json(contracts.reduce((accumulator, current) => [...accumulator, ...current.Jobs], []))
})

app.get('/jobs/:job_id/pay', getProfile, async (req, res) => {
    const {Profile, Job, Contract} = req.app.get('models')

    if (req.profile.type != 'client') {
        return res.status(403).json({message: "Only client can pay"})
    }
    
    const client = req.profile
    
    const job = await Job.findOne({
        where: {
            id: req.params.job_id,
            paid: null,
        },
        include: {
            model: Contract,
            where: {
                ClientId: client.id
            }
        }
    })

    if (job == null) {
        return res.status(404).json({message: "Job not found or is already paid"})
    }

    if (client.balance < job.price) {
        return res.status(400).json({message: "Unable to process payment: low balance"})
    }

    const contractor = await Profile.findOne({where: {id: job.Contract.ContractorId}})

    client.balance = client.balance - job.price
    client.save()

    contractor.balance = contractor.balance + job.price
    contractor.save()

    job.paid = true
    job.save()

    return res.status(200).json({message: "Job paid successfully"})  
})


app.get('/admin/best-profession', getProfile, async (req, res) => {

    const pattern = /\d{4}-\d{2}-\d{2}/

    if (RegExp(pattern, 'g').exec(req.query.start) == null || RegExp(pattern, 'g').exec(req.query.end) == null) {
        return res.status(400).json({message: "Please provide date ranges in this format: YYYY-MM-DD"})
    }

    const start = new Date(req.query.start)
    const end = new Date(req.query.end)
 
    const [result, metadata] = await sequelize.query(`
        SELECT P.profession, SUM(J.price) AS total from jobs J
        JOIN contracts C ON J.ContractId = C.id
        JOIN profiles P ON C.ContractorId = P.id
        WHERE J.paid = true AND J.paymentDate BETWEEN "${start.toISOString()}" AND "${end.toISOString()}"
        GROUP BY P.profession
        ORDER BY total desc
        LIMIT 1
    `);

    res.json(result)
})

module.exports = app;
