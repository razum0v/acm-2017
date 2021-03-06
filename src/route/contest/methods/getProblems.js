import { filterEntity as filter, getSymbolIndex } from '../../../utils';
import * as models from "../../../models";
import Promise from 'bluebird';

export function getProblemsRequest(req, res, next) {
  return Promise.resolve().then(() => {
    return getProblems(
      Object.assign(req.params, { user: req.user })
    );
  }).then(result => res.json(result)).catch(next);
}

export async function getProblems(params) {
  let {
    contestId, contest,
    userId, user
  } = params;
  
  if (!user) {
    user = await models.User.findByPrimary(userId);
  }
  if (!contest) {
    contest = await models.Contest.findByPrimary(contestId);
  }
  if (!user || !contest) {
    throw new HttpError('User or Contest not found');
  }
  return contest.getProblems({
    include: [{
      model: models.ProblemToContest,
      where: {
        contestId: contest.id
      }
    }, {
      model: models.Solution,
      required: false,
      include: [ models.Verdict ],
      where: {
        userId: user.id,
        contestId: contest.id
      }
    }],
    order: [
      [ models.ProblemToContest, 'id', 'ASC']
    ]
  }).map((problem, index) => {
    problem = Object.assign(problem.get({ plain: true }), {
      internalSymbolIndex: getSymbolIndex(index).toUpperCase()
    });
    return filter(problem, {
      exclude: [
        'ProblemToContest', 'ProblemToContests', 'textStatement'
      ],
      replace: [
        ['Solutions', 'verdictStatus', (fromValue) => {
          let accepted = false, wrongsNumber = 0;
          for (let solution of fromValue) {
            if (solution.verdictId === 1) {
              accepted = true;
              break;
            } else if (solution.Verdict && solution.Verdict.scored) {
              wrongsNumber++;
            }
          }
          return {
            accepted,
            wrongsNumber
          }
        }]
      ]
    })
  });
}