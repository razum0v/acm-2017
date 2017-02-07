import * as models from "../../../models";
import Promise from 'bluebird';
import userGroups from './../../../models/User/userGroups';
import * as contests from '../../contest/methods';

export function refreshSolutionRequest(req, res, next) {
  let params = Object.assign(
    Object.assign(req.params, req.body), {
      user: req.user,
    }
  );
  return Promise.resolve().then(() => {
    return refreshSolution(params);
  }).then(result => res.json(result)).catch(next);
}

export async function refreshSolution(params) {
  let {
    solutionId, solution
  } = params;
  
  if (!solution) {
    solution = await models.Solution.findByPrimary(solutionId);
  }
  
  return solution.update({
    nextAttemptWillBeAtMs: null,
    verdictId: null,
    memory: 0,
    executionTime: 0,
    testNumber: 0,
    retriesNumber: 0,
    verdictGotAtMs: null,
    refreshedNumber: solution.refreshedNumber + 1
  });
}