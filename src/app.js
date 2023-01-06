const express = require("express");
const bodyParser = require("body-parser");
const { Op, literal, Transaction, fn, col } = require("sequelize");
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

// recharges a client's balance
app.post("/balances/deposit/:userId", getProfile, async (req, res) => {
  const { Job, Contract, Profile } = req.app.get("models");

  const transaction = await sequelize.transaction({
    isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
  });
  try {
    // Can a client receive money from anyone, or can they just recharge themselves?
    // I assume the first, as otherwise there would be no reason to have {userId} parameter
    // as it might just be the same of {profile_id}
    const { userId } = req.params;

    const amount = Number(req.body?.amount);
    if (Number.isNaN(amount)) {
      return res.status(400).send();
    }

    // check the user exists and is actually a client
    const client = await Profile.findOne(
      {
        where: { id: userId, type: "client" },
      },
      { transaction }
    );
    if (!client) {
      return res.status(404).send();
    }

    // check the deposit amount isn't more than 25% of the amount to pay
    const {
      dataValues: { totalPrice },
    } = await Job.findOne(
      {
        include: Contract,
        attributes: [[fn("sum", col("price")), "totalPrice"]],
        group: "Contract.ClientId",
        where: { "$Contract.ClientId$": client.id, paid: null },
        nest: false,
      },
      { transaction }
    );
    if (amount > totalPrice * 0.25) {
      // Return "NOT FOUND" to avoid possible introspections
      return res.status(400).send();
    }

    // update user's balance
    const [n] = await Profile.update(
      { balance: literal(`balance+${amount}`) },
      { where: { id: client.id } },
      { transaction }
    );
    if (!n) {
      throw new Error("Failed to update profile");
    }

    await transaction.commit();

    return res.status(200).send();
  } catch (error) {
    console.error(error);
    await transaction.rollback();
    return res.status(500).send();
  }
});

module.exports = app;
