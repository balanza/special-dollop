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

describe("GET /jobs/unpaid", () => {
  ensureEndpointAuth(`/jobs/unpaid`);

  describe.each(seedData.profiles)(
    "When fetching all Contracts owned by Client#$id",
    ({ id: profileId }) => {
      const allMyContracts = seedData.contracts.filter(
        (e) => e.ClientId === profileId || e.ContractorId === profileId
      );

      it(`should all and only the upaid jobs for active contracts belonging to them`, async () => {
        const res = await request(app)
          .get(`/jobs/unpaid`)
          .set({ profile_id: profileId });

        expect(res.status).toEqual(200);
        expect(Array.isArray(res.body)).toBe(true);
        // check any result item
        console.log(res.body, allMyContracts)
        for (const { ContractId, paid } of res.body) {
          const contractOfJob = allMyContracts.find((c) => c.id === ContractId);
          // every job is relative to one of Client's contracts
          const belongsToContract = !!contractOfJob;
          expect(belongsToContract).toBe(true);
          // the contract is active
          expect(contractOfJob.status).toBe("in_progress");
          // every job is unpaid
          expect(paid).toBe(null);
        }
      });
    }
  );
});
