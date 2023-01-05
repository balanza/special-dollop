// Use an isolated database for each test scenario
// It works because Jest uses a separated worker for each file
// so we can override process variables individually
process.env.STORAGE_PATH = `database.test.${
  __filename.split("/").reverse()[0].split(".")[0]
}.sqlite3`;

const request = require("supertest");
const app = require("../src/app");
const { ensureEndpointAuth } = require("./commons");

describe("POST /jobs/:job_id/pay", () => {
  beforeEach(async () => {
    await require("../scripts/seedDb")();
  });

  ensureEndpointAuth(`/jobs/999/pay` /* any job id will do */, "post");

  it(`should fail to pay if Client has not enough money`, async () => {
    const aClientId = 4;
    const aJobId = 5;

    const res = await request(app)
      .post(`/jobs/${aJobId}/pay`)
      .set({ profile_id: aClientId });
    expect(res.status).toEqual(500);
  });

  it(`should fail to pay twice the same job (sequence)`, async () => {
    // known data
    const aClientId = 1;
    const aJobId = 1;

    const res1 = await request(app)
      .post(`/jobs/${aJobId}/pay`)
      .set({ profile_id: aClientId });
    expect(res1.status).toEqual(200);

    const res2 = await request(app)
      .post(`/jobs/${aJobId}/pay`)
      .set({ profile_id: aClientId });
    expect(res2.status).toEqual(500);
  });

  it(`should fail to pay twice the same job (parallel)`, async () => {
    // known data
    const aClientId = 1;
    const aJobId = 1;

    const [res1, res2] = await Promise.all([
      request(app).post(`/jobs/${aJobId}/pay`).set({ profile_id: aClientId }),
      request(app).post(`/jobs/${aJobId}/pay`).set({ profile_id: aClientId }),
    ]);

    // we don't know which one, but one fails and one succeedes
    expect([res1.status, res2.status].includes(200)).toBe(true)
    expect([res1.status, res2.status].includes(500)).toBe(true)
  });
});
