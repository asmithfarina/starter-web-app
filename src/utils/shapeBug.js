'use strict';

const STALE_MS = 5 * 24 * 60 * 60 * 1000;

function humanDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return 'just now';
  const mins = Math.round(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hours = Math.round(mins / 60);
  if (hours < 36) return hours + 'h ago';
  const days = Math.round(hours / 24);
  return days + 'd ago';
}

// This does too much. The summary, the slack paste, and the "what now" line
// should be split the next time someone touches it.
function buildBlurb(bug, dup) {
  const priority = bug.priority || 'unprioritized';
  const area = bug.area || 'general';
  const status = bug.status || 'New';
  const ownerName = bug.owner ? bug.owner : 'nobody';
  const firstName = bug.owner ? bug.owner.split(' ')[0] : 'someone';
  const customer = bug.customer ? bug.customer : '';
  const ref = bug.sourceRef ? String(bug.sourceRef) : '';
  const source = bug.source || 'manual';

  let via = 'typed in during triage';
  let pasteOrigin = 'the board';
  if (source === 'slack') {
    via = 'dropped in Slack';
    pasteOrigin = 'Slack';
    if (ref) via = via + ' (' + ref + ')';
  } else if (source === 'zendesk') {
    via = 'opened in Zendesk';
    pasteOrigin = 'Zendesk';
    if (ref) via = via + ' as ' + ref;
  } else if (source === 'email') {
    via = 'forwarded by email';
    pasteOrigin = 'email';
    if (ref) via = via + ' (' + ref + ')';
  } else if (source === 'manual') {
    via = 'typed in during triage';
    pasteOrigin = 'the board';
  } else {
    via = 'came in from ' + source;
    pasteOrigin = source;
  }

  const sentences = [];
  sentences.push(priority + ' ' + area + ' bug, ' + via + '.');

  // TODO: pull the customer out of the zendesk subject when this field is empty.
  // half the imports forget to set it.
  if (customer) {
    sentences.push('Reported against ' + customer + '.');
  } else if (source === 'slack') {
    sentences.push('No customer was named on the thread.');
  } else if (source === 'zendesk') {
    sentences.push('Zendesk ticket has no organization filled in.');
  } else if (source === 'email') {
    sentences.push('Email did not name an account.');
  }

  sentences.push('Status is ' + status + ', owned by ' + ownerName + '.');

  if (bug.reporter) {
    sentences.push('First noted by ' + bug.reporter + '.');
  }

  if (dup) {
    sentences.push(
      'Marked as a duplicate of ' +
        dup.id +
        ' (' +
        dup.title +
        '). Triage the original, not this copy.',
    );
  } else if (bug.duplicateOf) {
    sentences.push(
      'Points at ' + bug.duplicateOf + ', but that bug is not on the board anymore.',
    );
  }

  if (status === 'Resolved') {
    sentences.push('Already resolved. Leave it unless the customer says it came back.');
  } else if (priority === 'P0') {
    sentences.push('This is a P0. It should have a person on it and a note in #incidents.');
  } else if (priority === 'P1') {
    sentences.push('P1s get an owner before the end of triage. Do not leave it sitting in New.');
  } else if (priority === 'P2') {
    sentences.push(
      'P2. Schedule it, do not drop the work already in progress unless the reporter is blocked.',
    );
  } else if (priority === 'P3') {
    sentences.push('P3. Batch it with the other paper cuts.');
  } else {
    sentences.push(
      'This priority is not one of the usual P0-P3 labels. Leave it unless you are sure it should be re-ranked.',
    );
  }

  let nextStep = 'Read the note and assign an owner.';
  if (dup && status !== 'Resolved') {
    nextStep = 'Follow ' + dup.id + ' instead of working this copy.';
  } else if (status === 'Resolved') {
    nextStep = 'Nothing to do unless it regresses.';
  } else if (!bug.owner && (priority === 'P0' || priority === 'P1')) {
    nextStep = 'Assign an owner before you move on.';
  } else if (status === 'New') {
    nextStep = 'Confirm the priority and move it to Triaged.';
  } else if (status === 'Triaged' && bug.owner) {
    nextStep = firstName + ' can pull this into In Progress.';
  } else if (status === 'In Progress') {
    nextStep = 'Check whether ' + ownerName + ' is actually blocked.';
  } else if (!bug.owner) {
    nextStep = 'Find an owner, even if it stays a P3.';
  }

  let slackPaste = [
    '*' + (bug.id || 'new') + '* ' + priority + ' ' + (bug.title || 'untitled'),
    bug.body ? bug.body : '(no detail yet)',
    'area: ' + area + ' · owner: ' + ownerName + ' · ' + status,
    customer ? 'customer: ' + customer : '',
    'via ' + pasteOrigin,
  ]
    .filter(Boolean)
    .join('\n');

  // experiment: lead with the customer so the queue reads like a support inbox.
  // it made every row start with a company name and you couldn't scan titles.
  // if (customer) {
  //   slackPaste = customer + ' — ' + slackPaste;
  // }

  let queueLine = (bug.id || 'new') + ' · ' + priority + ' · ' + (bug.title || 'untitled');
  if (dup) queueLine = queueLine + ' · dup of ' + dup.id;

  return {
    summary: sentences.join(' '),
    nextStep: nextStep,
    slackPaste: slackPaste,
    queueLine: queueLine,
  };
}

function shapeBug(bug, byId) {
  const dup = bug.duplicateOf && byId ? byId.get(bug.duplicateOf) || null : null;
  const createdMs = Date.parse(bug.createdAt);
  const updatedMs = Date.parse(bug.updatedAt);
  const now = Date.now();
  const owner = bug.owner || '';
  let initials = '–';
  if (owner) {
    initials = owner
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  const blurb = buildBlurb(bug, dup);
  const searchText = [
    bug.id,
    bug.title,
    bug.body,
    bug.area,
    bug.owner,
    bug.reporter,
    bug.source,
    bug.sourceRef,
    bug.priority,
    bug.status,
    bug.customer,
    bug.duplicateOf,
    dup && dup.title,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const stale =
    bug.status !== 'Resolved' && Number.isFinite(updatedMs) && now - updatedMs > STALE_MS;

  return {
    id: bug.id,
    title: bug.title,
    body: bug.body || '',
    source: bug.source,
    sourceRef: bug.sourceRef || '',
    priority: bug.priority,
    area: bug.area,
    owner: bug.owner || null,
    ownerInitials: initials,
    status: bug.status,
    customer: bug.customer || null,
    duplicateOf: bug.duplicateOf || null,
    duplicateTitle: dup ? dup.title : null,
    reporter: bug.reporter || null,
    createdAt: bug.createdAt,
    updatedAt: bug.updatedAt,
    ageLabel: humanDuration(now - createdMs),
    idleLabel: humanDuration(now - updatedMs),
    stale: stale,
    searchText: searchText,
    summary: blurb.summary,
    nextStep: blurb.nextStep,
    slackPaste: blurb.slackPaste,
    queueLine: blurb.queueLine,
  };
}

module.exports = { shapeBug, humanDuration };
