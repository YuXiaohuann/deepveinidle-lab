const layouts = {
  heart: {capability:'bossHeartLayout', groups:{ore:[['chute']], bars:[['anvil']], coal:[['stoke']]}},
  kraken: {capability:'bossKrakenLayout', groups:{raw:[['barrel'],['stove'],['barrel','stove']], cooked:[['winch']]}},
  colony: {capability:'bossColonyLayout', groups:{logs:[['pyre']], bows:[['line']], staves:[['stakes']]}},
  blight: {capability:'bossBlightLayout', groups:{crops:[['trough']], draughts:[['well']], herbs:[['bed']]}},
  siege: {capability:'bossSiegeLayout', groups:{bolts:[['wagon'],['ladders']], leather:[['armourer']], cloth:[['bench']]}},
};

const nonnegative = value => Number.isFinite(value) && value >= 0;
const identifier = value => Number.isSafeInteger(value) && value >= 0;
const level = value => Number.isSafeInteger(value) && value > 0;
const point = tile => Number.isSafeInteger(tile?.x) && Number.isSafeInteger(tile?.y);
const sameTile = (left, right) => left.x === right.x && left.y === right.y;
const adjacent = (left, right) => Math.abs(left.x - right.x) <= 1 && Math.abs(left.y - right.y) <= 1;

// Each cycle switches away from work, enters banking, goes through the bank's
// idle transition and withdrawal, and enters and activates work again.
// A nonempty walk also takes a tick to start in each direction.
const interactionTicks = 6;

function bankEntrances(game, bank, station) {
  if (adjacent(bank, station)) return [station];
  const entrances = [];
  for (let trip = 0; trip <= 8; trip++) {
    const tile = game.siteEntrance(game.world, bank.x, bank.y, 0, station, trip);
    if (!point(tile) || !adjacent(tile, bank)) return null;
    if (entrances.length && sameTile(entrances[0], tile)) return entrances;
    entrances.push(tile);
  }
  return null;
}

function stationCycle(game, bank, stations, distance) {
  const legs = [];
  for (const [index, station] of stations.entries()) {
    const entrances = bankEntrances(game, bank, station);
    if (!entrances) return null;
    const next = stations[(index + 1) % stations.length];
    const start = index % entrances.length, segments = [];
    // The same station is visited every stations.length trips. The tied bank
    // entrance choices advance by that same interval until they repeat.
    let entrance = start;
    do {
      const bankTile = entrances[entrance];
      const back = distance(station, bankTile), out = distance(bankTile, next);
      if (back === null || out === null) return null;
      segments.push({back,out});
      entrance = (entrance + stations.length) % entrances.length;
    } while (entrance !== start);
    legs.push(segments);
  }
  return legs;
}

function feedTime(game, skill, category, recipe, itemId, tickSeconds) {
  if (!nonnegative(skill.speedMultiplier)) return {reason:'skillSpeed'};
  if (typeof game.bossFeedParts !== 'function') return {reason:'bossFeedParts'};
  const parts = game.bossFeedParts(itemId);
  if (!Number.isFinite(recipe.baseTicks) || recipe.baseTicks <= 0 || !level(parts)) return {reason:'bossFeedRules'};
  const farming = category.skill === 'farming';
  if (farming && typeof game.bossUsesFarmingSpeed !== 'function') return {reason:'bossUsesFarmingSpeed'};
  const crop = farming && game.bossUsesFarmingSpeed(itemId);
  if (typeof crop !== 'boolean') return {reason:'bossUsesFarmingSpeed'};
  if (!crop && !nonnegative(game.levelSpeedCoefficient)) return {reason:'levelSpeedCoefficient'};
  const factor = crop ? 1 : 1 + (skill.level - recipe.levelReq) * game.levelSpeedCoefficient;
  const chance = Math.min(1, skill.speedMultiplier * factor / recipe.baseTicks * parts);
  const seconds = tickSeconds * parts / chance;
  return Number.isFinite(seconds) && seconds > 0 ? {seconds} : {reason:'skillSpeed'};
}

export function createBossFeedEstimator(game) {
  const routes = new Map(), distances = new Map();

  function distance(from, to) {
    if (sameTile(from, to)) return 0;
    const key = `${from.x},${from.y}:${to.x},${to.y}`;
    if (!distances.has(key)) {
      const path = game.walkPath(game.world, from.x, from.y, to.x, to.y);
      if (path !== null && !Array.isArray(path)) throw Error('invalidResult: bossFeed walkPath');
      distances.set(key, path === null ? null : path.length);
    }
    return distances.get(key);
  }

  function bossRoutes(boss, category) {
    const key = `${boss.id}:${category}`;
    if (routes.has(key)) return routes.get(key);
    const model = Object.hasOwn(layouts, boss.key) ? layouts[boss.key] : null;
    const groups = model && Object.hasOwn(model.groups, category) ? model.groups[category] : null;
    const layout = model && game[model.capability];
    const sites = game.world?.sites;
    if (!groups || typeof boss.chestLook !== 'string' || typeof boss.look !== 'string' ||
        !Array.isArray(layout?.stations) || !Array.isArray(sites) ||
        typeof game.siteEntrance !== 'function' || typeof game.walkPath !== 'function') return null;
    const bank = sites.find(site => site?.look === boss.chestLook);
    const workSite = sites.find(site => site?.look === boss.look);
    if (!point(bank) || !identifier(bank.id) || !point(workSite) || !point(layout.site) ||
        !sameTile(workSite, layout.site)) return null;
    const variants = groups.map(kinds => {
      const stationGroups = kinds.map(kind => layout.stations.filter(station => station?.kind === kind)
        .map(station => station.tiles?.[0]));
      if (stationGroups.some(group => !group.length || !group.every(point))) return null;
      const stations = stationGroups.flat();
      const cycle = stationCycle(game, bank, stations, distance);
      return cycle && {bankSiteId:bank.id, stationKinds:kinds, stations, cycle};
    });
    routes.set(key, variants);
    return variants;
  }

  function routeTime(route, {strideSpeed,capacity}, bulkStack, tickSeconds) {
    const {cycle, ...geometry} = route;
    const report = {
      ...geometry,
      stationKinds: [...geometry.stationKinds],
      stations: geometry.stations.map(({x,y}) => ({x,y})),
    };
    if (bulkStack) return {seconds:0, route:{...report,itemsPerRefill:null}};
    const moveTicks = steps => Math.ceil(steps * 1000 / strideSpeed);
    let movement = 0, interactions = 0;
    for (const alternatives of cycle) {
      let walk = 0, starts = 0;
      for (const {back,out} of alternatives) {
        walk += moveTicks(back) + moveTicks(out);
        starts += Number(back > 0) + Number(out > 0);
      }
      movement += walk / alternatives.length;
      interactions += interactionTicks + starts / alternatives.length;
    }
    const meanTravelTicks = movement / cycle.length;
    const meanInteractionTicks = interactions / cycle.length;
    const seconds = (meanTravelTicks + meanInteractionTicks) * tickSeconds / capacity;
    if (!Number.isFinite(seconds)) return null;
    return {seconds, route:{...report,itemsPerRefill:capacity,meanTravelTicks,meanInteractionTicks}};
  }

  return function estimateBossFeedRate({character, task} = {}) {
    const {bossId, itemId} = task ?? {};
    if (!identifier(bossId) || !identifier(itemId)) throw Error('invalidBossFeedTask');
    const result = {bossId,itemId,skill:null,source:game.source??null,route:null,
      feedSecondsPerItem:null,logisticsSecondsPerItem:null,secondsPerItem:null,itemsPerHour:null,secondsPerItemRange:null};
    const failure = (reason, status='unknownTime') => ({...result,status,reason});
    if (!Array.isArray(game.bosses)) return failure('bosses');
    const boss = game.bosses.find(candidate => candidate?.id === bossId);
    if (!boss) return failure('bossId','ineligibleItem');
    if (!Array.isArray(boss.classes) || !Array.isArray(boss.skills) || !boss.skills.length || !level(game.bossUnlockLevel)) {
      return failure('bossRules');
    }
    if (typeof game.baseItemId !== 'function' || typeof game.itemTier !== 'function') return failure('itemEncoding');
    const base = game.baseItemId(itemId), tier = game.itemTier(itemId);
    if (!identifier(base) || !identifier(tier) || tier > 4 || (tier === 0 && base !== itemId)) {
      return failure('itemQuality','ineligibleItem');
    }
    const category = boss.classes.find(entry => Array.isArray(entry?.items) && entry.items.includes(base));
    if (!category) return failure('itemId','ineligibleItem');
    if (typeof category.skill !== 'string' || !boss.skills.includes(category.skill)) return failure('bossRules');
    result.skill = category.skill;
    if (tier > 0) {
      if (typeof game.itemSupportsRarity !== 'function' || typeof game.withRarity !== 'function') return failure('itemEncoding');
      const supportsRarity = game.itemSupportsRarity(base);
      if (typeof supportsRarity !== 'boolean') return failure('itemEncoding');
      if (!supportsRarity || game.withRarity(base, tier) !== itemId) return failure('itemQuality','ineligibleItem');
    }
    if (typeof game.bossFeedRecipe !== 'function') return failure('bossFeedRecipe');
    const recipe = game.bossFeedRecipe(base);
    if (!level(recipe?.levelReq)) return failure('bossFeedRules');
    const skill = character?.skills?.[category.skill];
    if (!level(skill?.level)) return failure('skillLevel');
    if (skill.level < recipe.levelReq) return failure('itemLevel','levelTooLow');
    const bossLevels = boss.skills.map(name => character?.skills?.[name]?.level);
    if (!bossLevels.some(value => level(value) && value >= game.bossUnlockLevel)) {
      return bossLevels.every(level) ? failure('bossLevel','levelTooLow') : failure('bossSkillLevel');
    }
    if (skill.speedMultiplier === 0) return failure('skillSpeed','unreachable');
    if (!Number.isFinite(game.tickMs) || game.tickMs <= 0) return failure('tickMs');
    const tickSeconds = game.tickMs / 1000;
    const feed = feedTime(game, skill, category, recipe, itemId, tickSeconds);
    result.feedSecondsPerItem = feed.seconds ?? null;
    const movement = character?.movement;
    if (!identifier(movement?.capacity)) return failure(feed.reason ?? 'movementCapacity');
    if (movement.capacity === 0) return failure('movementCapacity','unreachable');
    const stackable = typeof game.item === 'function' ? game.item(itemId)?.stackable : undefined;
    if (typeof stackable !== 'boolean') return failure(feed.reason ?? 'itemStackability');
    // The withdrawal adds one item first and then checks for another free
    // slot before taking the rest of an eligible stack.
    const bulkStack = stackable && movement.capacity >= 2;
    if (!bulkStack && (!Number.isFinite(movement.strideSpeed) || movement.strideSpeed <= 0)) {
      return failure(feed.reason ?? 'movementSpeed');
    }
    const variants = bossRoutes(boss, category.cls);
    const timed = variants?.map(route => route && routeTime(route, movement, bulkStack, tickSeconds)) ?? [];
    const primary = timed[0];
    if (primary) {
      result.route = primary.route;
      result.logisticsSecondsPerItem = primary.seconds;
    }
    if (feed.reason) return failure(feed.reason);
    const totals = timed.filter(Boolean).map(route => feed.seconds + route.seconds).filter(Number.isFinite);
    if (totals.length > 1) {
      result.secondsPerItemRange = {min:Math.min(...totals),max:Math.max(...totals),knownRoutes:totals.length,routeCount:timed.length};
    }
    if (!primary) return failure('bossRoute');
    const secondsPerItem = feed.seconds + primary.seconds, itemsPerHour = 3600 / secondsPerItem;
    if (!Number.isFinite(secondsPerItem) || !Number.isFinite(itemsPerHour)) return failure('bossRoute');
    return {...result,status:'ok',secondsPerItem,itemsPerHour};
  };
}
