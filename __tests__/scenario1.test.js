const request = require("supertest");
const app = require("../src/app");
const seedData = require("../scripts/data");

describe("GET /contracts/:id", () => {
  it("should give 401 when profile do not exists", async () => {
    const fakeProfileId = 999;
    const anyContractId = seedData.contracts[0].id; // any existing contract
    const res = await request(app)
      .get(`/contracts/${anyContractId}`)
      .set({ profile_id: fakeProfileId });

    expect(res.status).toEqual(401);
  });

  it("should give 404 when contract do not exists", async () => {
    const anyProfileId = seedData.profiles[0].id; // any existing profile
    const fakeContractId = 999;
    const res = await request(app)
      .get(`/contracts/${fakeContractId}`)
      .set({ profile_id: anyProfileId });

    expect(res.status).toEqual(404);
  });

  it("should give 401 when no profile is provided", async () => {
    const anyContractId = 1;
    const res = await request(app).get(`/contracts/${anyContractId}`);

    expect(res.status).toEqual(401);
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
