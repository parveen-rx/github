import {addEvent, addTiming, FIVE_MINUTES_IN_MILLISECONDS,
  FakeReporter, incrementCounter, reporterProxy, setGitHubUser} from '../lib/reporter-proxy';
const pjson = require('../package.json');

const version = pjson.version;

const fakeReporter = new FakeReporter();

describe('reporterProxy', function() {
  const event = {coAuthorCount: 2};
  const eventType = 'commits';

  const timingEventType = 'load';
  const durationInMilliseconds = 42;

  const counterName = 'push';
  beforeEach(function() {
    // let's not leak state between tests, dawg.
    reporterProxy.events = [];
    reporterProxy.timings = [];
    reporterProxy.counters = [];
    reporterProxy.gitHubUser = null;
  });

  describe('before reporter has been set', function() {
    it('adds event to queue when addEvent is called', function() {
      addEvent(eventType, event);

      const events = reporterProxy.events;
      assert.deepEqual(events.length, 1);
      const actualEvent = events[0];
      assert.deepEqual(actualEvent.eventType, eventType);
      assert.deepEqual(actualEvent.event, {coAuthorCount: 2, gitHubPackageVersion: version});
    });

    it('adds timing to queue when addTiming is called', function() {
      addTiming(timingEventType, durationInMilliseconds);

      const timings = reporterProxy.timings;
      assert.deepEqual(timings.length, 1);
      const timing = timings[0];

      assert.deepEqual(timing.eventType, timingEventType);
      assert.deepEqual(timing.durationInMilliseconds, durationInMilliseconds);
      assert.deepEqual(timing.metadata, {gitHubPackageVersion: version});
    });

    it('adds counter to queue when incrementCounter is called', function() {
      incrementCounter(counterName);

      const counters = reporterProxy.counters;
      assert.deepEqual(counters.length, 1);
      assert.deepEqual(counters[0], counterName);
    });

    it('sets gitHubUser when setGitHubUser is called', function() {
      const gitHubUser = 'annthurium';
      reporterProxy.setGitHubUser(gitHubUser);
      assert.deepEqual(reporterProxy.gitHubUser, gitHubUser);
    })
  });
  describe('if reporter is never set', function() {
    it('sets the reporter to no op class once interval has passed', function() {
      const clock = sinon.useFakeTimers();
      const setReporterSpy = sinon.spy(reporterProxy, 'setReporter');

      addEvent(eventType, event);
      addTiming(timingEventType, durationInMilliseconds);
      incrementCounter(counterName);

      assert.deepEqual(reporterProxy.events.length, 1);
      assert.deepEqual(reporterProxy.timings.length, 1);
      assert.deepEqual(reporterProxy.counters.length, 1);
      assert.isFalse(setReporterSpy.called);
      assert.isNull(reporterProxy.reporter);

      setTimeout(() => {
        assert.isTrue(reporterProxy.reporter);
        assert.isTrue(setReporterSpy.called);
        assert.deepEqual(reporterProxy.events.length, 0);
        assert.deepEqual(reporterProxy.timings.length, 0);
        assert.deepEqual(reporterProxy.counters.length, 0);
      }, FIVE_MINUTES_IN_MILLISECONDS);

      clock.restore();
    });
  });
  describe('after reporter has been set', function() {
    let addCustomEventStub, addTimingStub, incrementCounterStub;
    beforeEach(function() {
      addCustomEventStub = sinon.stub(fakeReporter, 'addCustomEvent');
      addTimingStub = sinon.stub(fakeReporter, 'addTiming');
      incrementCounterStub = sinon.stub(fakeReporter, 'incrementCounter');
    });
    it('empties all queues', function() {
      addEvent(eventType, event);
      addTiming(timingEventType, durationInMilliseconds);
      incrementCounter(counterName);

      assert.isFalse(addCustomEventStub.called);
      assert.isFalse(addTimingStub.called);
      assert.isFalse(incrementCounterStub.called);

      assert.deepEqual(reporterProxy.events.length, 1);
      assert.deepEqual(reporterProxy.timings.length, 1);
      assert.deepEqual(reporterProxy.counters.length, 1);

      reporterProxy.setReporter(fakeReporter);

      const addCustomEventArgs = addCustomEventStub.lastCall.args;
      assert.deepEqual(addCustomEventArgs[0], eventType);
      assert.deepEqual(addCustomEventArgs[1], {coAuthorCount: 2, gitHubPackageVersion: version});

      const addTimingArgs = addTimingStub.lastCall.args;
      assert.deepEqual(addTimingArgs[0], timingEventType);
      assert.deepEqual(addTimingArgs[1], durationInMilliseconds);
      assert.deepEqual(addTimingArgs[2], {gitHubPackageVersion: version});

      assert.deepEqual(incrementCounterStub.lastCall.args, [counterName]);
    });
    it('calls addCustomEvent directly, bypassing queue', function() {
      assert.isFalse(addCustomEventStub.called);
      reporterProxy.setReporter(fakeReporter);

      addEvent(eventType, event);
      assert.deepEqual(reporterProxy.events.length, 0);

      const addCustomEventArgs = addCustomEventStub.lastCall.args;
      assert.deepEqual(addCustomEventArgs[0], eventType);
      assert.deepEqual(addCustomEventArgs[1], {coAuthorCount: 2, gitHubPackageVersion: version});
    });
    it('calls addTiming directly, bypassing queue', function() {
      assert.isFalse(addTimingStub.called);
      reporterProxy.setReporter(fakeReporter);

      addTiming(timingEventType, durationInMilliseconds);
      assert.deepEqual(reporterProxy.timings.length, 0);

      const addTimingArgs = addTimingStub.lastCall.args;
      assert.deepEqual(addTimingArgs[0], timingEventType);
      assert.deepEqual(addTimingArgs[1], durationInMilliseconds);
      assert.deepEqual(addTimingArgs[2], {gitHubPackageVersion: version});
    });
    it('calls incrementCounter directly, bypassing queue', function() {
      assert.isFalse(incrementCounterStub.called);
      reporterProxy.setReporter(fakeReporter);

      incrementCounter(counterName);
      assert.deepEqual(reporterProxy.counters.length, 0);

      assert.deepEqual(incrementCounterStub.lastCall.args, [counterName]);
    });
    it('sets reporter.gitHubUser after reporter is set', function() {
      const gitHubUser = 'annthurium';
      const setGitHubUserStub = sinon.stub(fakeReporter, 'setGitHubUser');
      assert.isFalse(setGitHubUserStub.called);
      reporterProxy.setGitHubUser(gitHubUser);
      assert.deepEqual(reporterProxy.gitHubUser, gitHubUser);
      reporterProxy.setReporter(fakeReporter);
      const args = setGitHubUserStub.lastCall.args;
      assert.deepEqual(args[0], gitHubUser);
    });

    it('does not set reporter.gitHubUser if gitHubUser is null', function() {
      assert.isNull(reporterProxy.gitHubUser);
      const setGitHubUserStub = sinon.stub(fakeReporter, 'setGitHubUser');
      assert.isFalse(setGitHubUserStub.called);
      reporterProxy.setReporter(fakeReporter);
      assert.isFalse(setGitHubUserStub.called);
    });

  });
});
