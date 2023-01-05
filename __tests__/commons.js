const request = require("supertest");
const app = require("../src/app");

// Given a path, performs tests to ensure is only accessible by providing a valid Profile
const ensureEndpointAuth = (path, method = "get") => {
  it("should give 401 when profile do not exists", async () => {
    const fakeProfileId = 999;
    const res = await request(app)[method](path).set({ profile_id: fakeProfileId });

    expect(res.status).toEqual(401);
  });

  it("should give 401 when no profile is provided", async () => {
    const res = await request(app)[method](path);

    expect(res.status).toEqual(401);
  });
};

module.exports = { ensureEndpointAuth };
