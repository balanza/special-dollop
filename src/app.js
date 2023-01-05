const express = require("express");
const bodyParser = require("body-parser");
const { Op } = require("sequelize");
const { sequelize } = require("./model");
const { getProfile } = require("./middleware/getProfile");
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

module.exports = app;
