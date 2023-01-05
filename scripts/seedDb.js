const { Profile, Contract, Job } = require('../src/model');
const { profiles, contracts, jobs } = require('./data');

/* WARNING THIS WILL DROP THE CURRENT DATABASE */
seed();

async function seed() {
  // create tables
  await Profile.sync({ force: true });
  await Contract.sync({ force: true });
  await Job.sync({ force: true });
  //insert data
  await Promise.all([
    ...profiles.map(e => Profile.create(e)),
    ...contracts.map(e => Contract.create(e)),
    ...jobs.map(e => Job.create(e)),
  ])
}
