// Use an isolated database for each test scenario
// It works because Jest uses a separated worker for each file
// so we can override process variables individually
process.env.STORAGE_PATH = `database.test.${
  __filename.split("/").reverse()[0].split(".")[0]
}.sqlite3`;

const request = require("supertest");
const app = require("../src/app");
const { Profile } = require("../src/model");
const { ensureEndpointAuth } = require("./commons");
const seedData = require("../scripts/data");

describe("POST /balances/deposit/:userId", () => {
  beforeEach(async () => {
    await require("../scripts/seedDb")();
  });

  ensureEndpointAuth(`/balances/deposit/999` /* any id will do */, "post");

  it("should fail when no amount is specified", async () => {
    const anExistingProfile = seedData.profiles[0];

    const res = await request(app)
      .post(`/balances/deposit/999`)
      .set({ profile_id: anExistingProfile.id });
    expect(res.status).toEqual(400);
  });

  it("should fail if amount is not a number", async () => {
    const anExistingProfile = seedData.profiles[0];

    const res = await request(app)
      .post(`/balances/deposit/999`)
      .send({ amount: "hi!" })
      .set({ profile_id: anExistingProfile.id });
    expect(res.status).toEqual(400);
  });

  it("should fail if try to deposit on a non-client user", async () => {
    const aContractoProfile = seedData.profiles.find(
      (p) => p.type === "contractor"
    );
    const anExistingProfile = seedData.profiles[0];

    const res = await request(app)
      .post(`/balances/deposit/${aContractoProfile.id}`)
      .send({ amount: 100 })
      .set({ profile_id: anExistingProfile.id });
    expect(res.status).toEqual(404);
  });

  it("should fail if try to deposit on a non-existing user", async () => {
    const anExistingProfile = seedData.profiles[0];

    const res = await request(app)
      .post(`/balances/deposit/999`)
      .send({ amount: 100 })
      .set({ profile_id: anExistingProfile.id });
    expect(res.status).toEqual(404);
  });

  it("should add the correct amount", async () => {
    const aClientProfile = seedData.profiles.find((p) => p.type === "client");
    const amount = 1;

    const res = await request(app)
      .post(`/balances/deposit/${aClientProfile.id}`)
      .send({ amount })
      .set({ profile_id: aClientProfile.id });
    expect(res.status).toEqual(200);

    const current = await Profile.findByPk(aClientProfile.id);
    expect(current.balance).toBe(aClientProfile.balance + amount);
  });

  it("should not update balance if the amount is too much", async () => {
    const aClientProfile = seedData.profiles.find((p) => p.type === "client");
    const amount = 99999;

    const res = await request(app)
      .post(`/balances/deposit/${aClientProfile.id}`)
      .send({ amount })
      .set({ profile_id: aClientProfile.id });
    expect(res.status).toEqual(400);

    const current = await Profile.findByPk(aClientProfile.id);
    expect(current.balance).toBe(aClientProfile.balance);
  });
});
