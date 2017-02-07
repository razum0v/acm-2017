import * as models from '../../../models';
import Promise from 'bluebird';
import * as contests from './index';
import { makeSourceWatermark, SYNTAX_PYTHON_LITERAL_COMMENT } from '../../../utils';
import deap from 'deap';

export function sendSolutionRequest(req, res, next) {
  return Promise.resolve().then(() => {
    let { contestId } = req.params;
    let user = req.user;
    let params = Object.assign(
      req.body, {
        contestId,
        user,
        ip: req._ip
      }
    );
    return sendSolution(params);
  }).then(result => res.json(result)).catch(next);
}

export async function sendSolution(params) {
  let {
    contestId, contest, symbolIndex,
    languageId, solution,
    userId, user, ip
  } = params;
  
  if (!user) {
    user = await models.User.findByPrimary(userId)
  }
  if (!contest) {
    contest = await models.Contest.findByPrimary(contestId);
  }
  if (!user || !contest) {
    throw new HttpError('User or Contest not found');
  }
  
  let canSend = (
    ![ 'NOT_ENABLED', 'REMOVED', 'FINISHED', 'WAITING' ].includes(contest.status)
    || user.isAdmin
  );
  
  if (!canSend) {
    throw new HttpError('You have no permissions to send solutions when contest is disabled or finished');
  }
  
  let problem = await contests.getProblemBySymbolIndex({ contest, symbolIndex });
  let language = await models.Language.findOne({
    where: { id: languageId }
  });
  
  if (!language) {
    throw new HttpError('Language not found');
  }
  
  if (problem.systemType === 'acmp' && solution.length <= 12) {
    throw new HttpError('ACMP restriction: ' +
      'Solution is too short. Please send solution with more than 12 characters.');
  }
  
  let solutionInstance = await contest.createSolution({
    userId: user.id,
    problemId: problem.id,
    languageId: language.id,
    sourceCode: solution,
    ip
  });
  
  if (problem.systemType === 'cf') {
    if ([ 'c', 'csharp', 'java', 'javascript', 'php' ].includes(language.languageFamily)) {
      await makeSourceWatermark({ solutionInstance });
    } else if ([ 'python' ].includes(language.languageFamily)) {
      await makeSourceWatermark({ solutionInstance, commentLiteral: SYNTAX_PYTHON_LITERAL_COMMENT });
    }
  }
  
  return solutionInstance;
}