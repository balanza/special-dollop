const request = require("supertest");
const app = require("../src/app");
const seedData = require("../scripts/data");

jest.setTimeout(1e6);

describe("GET /contracts", () => {
  it("should give 401 when profile do not exists", async () => {
    const fakeProfileId = 999;
    const res = await request(app)
      .get(`/contracts`)
      .set({ profile_id: fakeProfileId });

    expect(res.status).toEqual(401);
  });

  it("should give 401 when no profile is provided", async () => {
    const res = await request(app).get(`/contracts`);

    expect(res.status).toEqual(401);
  });

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
