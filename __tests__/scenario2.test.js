// Use an isolated database for each test scenario
// It works because Jest uses a separated worker for each file
// so we can override process variables individually
process.env.STORAGE_PATH=`database.test.${__filename.split("/").reverse()[0].split(".")[0]}.sqlite3`

const request = require("supertest");
const app = require("../src/app");
const seedData = require("../scripts/data");
const { ensureEndpointAuth } = require("./commons");

beforeAll(async () => {
  await require("../scripts/seedDb")()}
)

describe("GET /contracts", () => {

  ensureEndpointAuth(`/contracts`);

  describe.each(seedData.profiles)(
    "When fetching all Contracts owned by Profile#$id",
    ({ id: OwnerId }) => {
      it(`should all and only the terminated contracts belonging to them`, async () => {
        const res = await request(app)
          .get(`/contracts`)
          .set({ profile_id: OwnerId });

        expect(res.status).toEqual(200);
        expect(Array.isArray(res.body)).toBe(true);
        // check any result item
        for (const { ClientId, ContractorId, status } of res.body) {
          // every contract is owned by the requesting profile either as a client or a contractor
          expect([ContractorId, ClientId]).toContain(OwnerId);
          // every contract is not terminated
          expect(status).not.toBe("terminated");
        }
      });
    }
  );
});
