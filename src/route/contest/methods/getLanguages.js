import * as models from "../../../models";
import Promise from 'bluebird';
import * as contests from './index';
import Sequelize from 'sequelize';
import filter from "../../../utils/filter";

export function getLanguagesRequest(req, res, next) {
  return Promise.resolve().then(() => {
    return getLanguages(req.params);
  }).then(result => res.json(result)).catch(next);
}

export async function getLanguages(params) {
  let problem = await contests.getProblemBySymbolIndex(params);
  let { systemType } = problem;
  return models.Language.findAll({
    where: { systemType },
    attributes: {
      include: [
        [ Sequelize.fn('COUNT', Sequelize.col('Solutions.id')), 'popularity']
      ]
    },
    include: [ models.Solution ],
    group: [ 'Solutions.languageId' ],
    order: 'popularity DESC'
  }).map(language => {
    return filter(language.get({ plain: true }), {
      exclude: [ 'Solutions' ]
    })
  }).then(async languages => {
    let ids = languages.map(language => language.id);
    return [
      languages,
      await models.Language.findAll({
        where: {
          id: {
            $notIn: ids
          },
          systemType
        }
      })
    ];
  }).spread((popularLanguages, restLanguages) => {
    return popularLanguages.concat(restLanguages);
  });
}