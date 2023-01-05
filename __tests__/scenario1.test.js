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

describe("GET /contracts/:id", () => {

  ensureEndpointAuth(`/contracts/999` /* any contract id */);
  
  it("should give 404 when contract do not exists", async () => {
    const anyProfileId = seedData.profiles[0].id; // any existing profile
    const fakeContractId = 999;
    const res = await request(app)
      .get(`/contracts/${fakeContractId}`)
      .set({ profile_id: anyProfileId });

    expect(res.status).toEqual(404);
  });

  describe.each(seedData.contracts)(
    "When fetching Contract#$id",
    ({
      id: ContractId,
      ClientId: OwnerClientId,
      ContractorId: OwnerContractorId,
    }) => {
      it(`should return the contract for the owner Client#${OwnerClientId}`, async () => {
        const res = await request(app)
          .get(`/contracts/${ContractId}`)
          .set({ profile_id: OwnerClientId });

        expect(res.status).toEqual(200);
      });

      it(`should return the contract for the owner Contractor#${OwnerContractorId}`, async () => {
        const res = await request(app)
          .get(`/contracts/${ContractId}`)
          .set({ profile_id: OwnerContractorId });

        expect(res.status).toEqual(200);
      });

      const nonOwners = seedData.profiles.filter(
        (e) => e.id !== OwnerClientId && e.id !== OwnerContractorId
      );
      it.each(nonOwners)(
        `should not return the contract for non-owner profiles like #$id`,
        async ({ id }) => {
          const res = await request(app)
            .get(`/contracts/${ContractId}`)
            .set({ profile_id: id });

          expect(res.status).toEqual(404);
        }
      );
    }
  );
});
