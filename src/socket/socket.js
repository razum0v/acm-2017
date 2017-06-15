/*
 * MISIS ACM SYSTEM
 * https://github.com/IPRIT
 *
 * Copyright (c) 2017 "IPRIT" Alex Belov, contributors
 * Licensed under the BSD license.
 * Created on 16.02.2017
 */

import crypto from 'crypto';
import * as models from "../models";

let io,
  hashSalt = 'misis_acm_belov_2017',
  initializedAtMs;

export function initialize(s_io) {
  io = s_io;
  initializedAtMs = Date.now();
}

export function getInstance() {
  return io;
}

export function subscribeEvents(socket) {
  console.info(`[${socket.id}] connected to the server.`, );
  
  socket.emit('server started', {
    socketId: socket.id,
    startedAt: initializedAtMs
  });
  
  socket.on('contest.join', data => {
    let { contestId, userId } = data;
    if (!contestId || !userId) {
      return;
    }
    console.info(`[${userId}:${socket.id}] joined the contest: ${contestId}.`);
    let contestHashKey = getContestHashKey(contestId);
    let userHashKey = getUserHashKey([ contestId, userId ].join('_'));
    socket.join(contestHashKey);
    socket.join(userHashKey);
  });
  
  socket.on('contest.left', data => {
    let { contestId, userId } = data;
    if (!contestId || !userId) {
      return;
    }
    console.info(`[${userId}:${socket.id}] left the contest: ${contestId}.`);
    let contestHashKey = getContestHashKey(contestId);
    let userHashKey = getUserHashKey([ contestId, userId ].join('_'));
    socket.leave(contestHashKey);
    socket.leave(userHashKey);
  });

  socket.on('solutions.listen', async data => {
    let { userId } = data;
    if (!userId) {
      return;
    }
    let user = await models.User.findByPrimary(userId);

    let solutionsHashKey;
    if (user.isAdmin) {
      solutionsHashKey = getAdminSolutionsHashKey();
    } else {
      solutionsHashKey = getUserSolutionsHashKey( userId );
    }
    socket.join(solutionsHashKey);
    console.info(`[${userId}:${socket.id}] started listening solutions updates.`);
  });

  socket.on('solutions.stopListen', async data => {
    let { userId } = data;
    if (!userId) {
      return;
    }
    let user = await models.User.findByPrimary(userId);

    let solutionsHashKey;
    if (user.isAdmin) {
      solutionsHashKey = getAdminSolutionsHashKey();
    } else {
      solutionsHashKey = getUserSolutionsHashKey( userId );
    }
    socket.leave(solutionsHashKey);
    console.info(`[${userId}:${socket.id}] stopped listening solutions updates.`);
  });

  socket.on('scanner-console.listenLogs', async data => {
    socket.join( getScannerConsoleLogsHashKey() );
    console.info(`[${socket.id}] started listening scanner console logs.`);
  });

  socket.on('scanner-console.stopListenLogs', async data => {
    socket.leave( getScannerConsoleLogsHashKey() );
    console.info(`[${socket.id}] stopped listening scanner console logs.`);
  });
  
  socket.on('disconnect', function (data) {
    console.log(`[${socket.id}] disconnected from the server.`, );
  });
}

function getContestHashKey(str) {
  return crypto.createHash('md5').update('contest' + str + hashSalt).digest('hex');
}

function getUserHashKey(str) {
  return crypto.createHash('md5').update('user' + str + hashSalt).digest('hex');
}

function getAdminSolutionsHashKey(adminRoom = 'default') {
  return crypto.createHash('md5').update(`admin_solutions_${adminRoom}_${hashSalt}`).digest('hex');
}

function getUserSolutionsHashKey(userRoom = 'default') {
  return crypto.createHash('md5').update(`user_solutions_${userRoom}_${hashSalt}`).digest('hex');
}

function getScannerConsoleLogsHashKey() {
  return crypto.createHash('md5').update(`scanner.console.log`).digest('hex');
}

export function emitNewSolutionEvent(params = {}, target = 'contest') {
  let eventName = 'new solution';
  if (target === 'contest') {
    let { contestId, solution } = params;
    emitContestEvent(contestId, eventName, solution);
  } else if (target === 'user') {
    let { contestId, userId, solution } = params;
    emitUserEvent(contestId, userId, eventName, solution);
  }
}

export function emitTableUpdateEvent(params = {}, target = 'contest') {
  let eventName = 'table update';
  if (target === 'contest') {
    let { contestId } = params;
    emitContestEvent(contestId, eventName, {});
  } else if (target === 'user') {
    let { contestId, userId } = params;
    emitUserEvent(contestId, userId, eventName, {});
  }
}

export function emitVerdictUpdateEvent(params = {}, target = 'contest') {
  let eventName = 'verdict updated';
  if (target === 'contest') {
    let { contestId, solution } = params;
    emitContestEvent(contestId, eventName, solution);
  } else if (target === 'user') {
    let { contestId, userId, solution } = params;
    emitUserEvent(contestId, userId, eventName, solution);
  }
}

export function emitNewMessageEvent(params = {}, target = 'contest') {
  let eventName = 'new message';
  if (target === 'contest') {
    let { contestId, message } = params;
    emitContestEvent(contestId, eventName, message);
  } else if (target === 'user') {
    let { contestId, userId, message } = params;
    emitUserEvent(contestId, userId, eventName, message);
  }
}

export function emitResetSolutionEvent(params = {}, target = 'contest') {
  let eventName = 'reset solution';
  if (target === 'contest') {
    let { contestId, solutionId } = params;
    emitContestEvent(contestId, eventName, { solutionId });
  } else if (target === 'user') {
    let { contestId, userId, solutionId } = params;
    emitUserEvent(contestId, userId, eventName, { solutionId });
  }
}

function emitContestEvent(contestId, eventName, data = {}) {
  let contestHashKey = getContestHashKey(contestId);
  console.info(`Emitting socket.io contest's event: ${eventName}:${contestId}`);
  io.to(contestHashKey).emit(eventName, data);
}

function emitUserEvent(contestId, userId, eventName, data = {}) {
  let userHashKey = getUserHashKey([ contestId, userId ].join('_'));
  console.info(`Emitting socket.io user's event: ${eventName}:${contestId}_${userId}`);
  io.to(userHashKey).emit(eventName, data);
}

export function emitUserSolutionsEvent(userId, eventName, data = {}) {
  let userHashKey = getUserSolutionsHashKey( userId );
  console.info(`[Solutions] Emitting socket.io user's event: ${eventName}:${userId}`);
  io.to(userHashKey).emit(eventName, data);
}

export function emitAdminSolutionsEvent(eventName, data = {}) {
  let adminHashKey = getAdminSolutionsHashKey();
  console.info(`[Solutions] Emitting socket.io admin's event: ${eventName}`);
  io.to(adminHashKey).emit(eventName, data);
}

export function emitScannerConsoleLog(consoleLogMessage) {
  let roomKey = getScannerConsoleLogsHashKey();
  let eventName = 'scanner-console.log';
  console.log(consoleLogMessage);
  io.to(roomKey).emit(eventName, { message: consoleLogMessage });
}