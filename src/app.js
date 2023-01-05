const express = require("express");
const bodyParser = require("body-parser");
const { Op } = require("sequelize");
const { sequelize } = require("./model");
const { getProfile } = require("./middleware/getProfile");
const { getJob } = require("./middleware/getJob");
const app = express();
app.use(bodyParser.json());
app.set("sequelize", sequelize);
app.set("models", sequelize.models);

// returns all non-terminated contracts for a client
app.get("/contracts", getProfile, async (req, res) => {
  const { Contract } = req.app.get("models");
  const contract = await Contract.findAll({
    where: {
      [Op.and]: [
        { status: { [Op.ne]: "terminated" } },
        {
          [Op.or]: [
            { ClientId: req.profile.id },
            { ContractorId: req.profile.id },
          ],
        },
      ],
    },
    where: { ClientId: req.profile.id, status: { [Op.ne]: "terminated" } },
  });
  res.json(contract);
});

// returns contract by id
app.get("/contracts/:id", getProfile, async (req, res) => {
  const { Contract } = req.app.get("models");
  const { id } = req.params;
  const contract = await Contract.findOne({
    where: {
      [Op.and]: [
        { id },
        {
          [Op.or]: [
            { ClientId: req.profile.id },
            { ContractorId: req.profile.id },
          ],
        },
      ],
    },
  });
  if (!contract) return res.status(404).end();
  res.json(contract);
});

// returns all unpaid jobs for active contracts
app.get("/jobs/unpaid", getProfile, async (req, res) => {
  const { Job, Contract } = req.app.get("models");
  try {
    const contract = await Job.findAll({
      include: Contract,
      where: {
        [Op.and]: [
          {
            paid: null,
            "$Contract.status$": "in_progress",
          },
          {
            [Op.or]: [
              { "$Contract.ClientId$": req.profile.id },
              { "$Contract.ContractorId$": req.profile.id },
            ],
          },
        ],
      },
    });
    if (!contract) return res.status(404).end();
    res.json(contract);
  } catch (error) {
    console.error(error);
    res.status(500).send();
  }
});

// pays out a job
app.post("/jobs/:job_id/pay", getProfile, getJob, async (req, res) => {
  const { Job, Contract, Profile } = req.app.get("models");
  const transaction = await sequelize.transaction();
  try {
    // Check the job is unpaid and get its price and ContractorId
    const {
      price,
      Contract: { ContractorId },
    } = await Job.findOne(
      { include: Contract, where: { paid: null, id: req.job.id } },
      { transaction }
    );

    // Check the client has enough money
    const { balance } = await Profile.findOne(
      { where: { id: req.profile.id } },
      { transaction }
    );

    if (price > balance) {
      throw new Error("not enough money");
    }

    const [[updatedJobs], [updatedClient], [updatedContractor]] =
      await Promise.all([
        // Send money to Contractor
        Profile.update(
          { balance: balance + price },
          { where: { id: ContractorId } },
          { transaction }
        ),

        // Withdraw from client
        Profile.update(
          { balance: balance - price },
          { where: { id: req.profile.id, balance: { [Op.gte]: price } } },
          { transaction }
        ),

        // Set job as done
        Job.update(
          { paid: true, paymentDate: new Date().toUTCString() },
          { where: { id: req.job.id, paid: null } },
          { transaction }
        ),
      ]);

    if (!updatedJobs) {
      throw new Error("Failed to update job, maybe a concurrency issue?");
    }
    if (!updatedClient) {
      throw new Error("Failed to update client, maybe not enough money?");
    }
    if (!updatedContractor) {
      throw new Error("Failed to update contractor");
    }

    await transaction.commit();
    res.status(200);
  } catch (error) {
    console.error(error);
    await transaction.rollback();

    res.status(500);
  }
  res.end();
});

module.exports = app;
