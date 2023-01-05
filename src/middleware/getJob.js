const getJob = async (req, res, next) => {
  const { Job, Contract } = req.app.get("models");
  const job = await Job.findOne({
    include: Contract,
    where: {
      id:req.params["job_id"]|| 0,
      "$Contract.ClientId$": req.get("profile_id") || 0,
    },
  });
  console.log('---> ', job, req.params["job_id"],req.get("profile_id"))
  if (!job) return res.status(404).end();
  req.job = job;
  next();
};
module.exports = { getJob };
