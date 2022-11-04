process.env.NODE_ENV = "test"
const request = require("supertest")
const app = require("../src/app")
const fs = require('fs')
const { Profile, Contract, Job } = require('../src/model');

beforeAll(async () => {
    await Profile.sync({ force: true });
    await Contract.sync({ force: true });
    await Job.sync({ force: true });
});

const clientId = 1
const contractorId = 2

describe("Create users", () => {

    test("Create client", async () => {    

        const user = await Profile.create({
            id: clientId,
            firstName: 'Client',
            lastName: 'User',
            profession: 'Wizard',
            balance: 100,
            type:'client'
        })
    
        expect(user.firstName).toBe('Client');
    })

    test("Create contractor", async () => {    

        const user = await Profile.create({
            id: contractorId,
            firstName: 'Contractor',
            lastName: 'User',
            profession: 'Wizard',
            balance: 100,
            type:'client'
        })
    
        expect(user.firstName).toBe('Contractor');
    })
})

describe('Create and get contracts from REST API', () => {
    test("Create contracts", async () => {

        ['First contract', 'Second contract', 'Third contract'].map(async title => {
            await Contract.create({
                terms: title,
                status: 'in_progress',
                ClientId: clientId,
                ContractorId: contractorId
            })
        })
    })

    test("Requires profile_id auth header to gegt contracts", async () => {
        const response = await request(app).get("/contracts")
        expect(response.statusCode).toBe(401)
    })

    test("GET /contract/:id with profile_id header", async () => {
        const response = await request(app)
          .get("/contracts/1")
          .set("profile_id", clientId);

        expect(response.statusCode).toBe(200)
    })

    test("GET /contracts for client", async () => {
        const response = await request(app)
          .get("/contracts")
          .set("profile_id", clientId);

        expect(response.statusCode).toBe(200)
        expect(response.body.length).toBe(3)
    })
})

