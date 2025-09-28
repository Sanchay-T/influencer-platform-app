import assert from 'node:assert/strict';
import { deriveInitialStateFromSearchData } from '../../app/components/campaigns/similar-search/utils/initial-state';

function expectEqual(actual: unknown, expected: unknown, message: string) {
  try {
    assert.deepEqual(actual, expected, message);
  } catch (error) {
    console.error('\u274c', message);
    throw error;
  }
}

(async () => {
  const populated = deriveInitialStateFromSearchData({
    status: 'completed',
    creators: [{ id: '1' }, { id: '2' }],
  });

  expectEqual(
    populated,
    { creators: [{ id: '1' }, { id: '2' }], isLoading: false },
    'should reuse creators for completed runs'
  );

  const emptyCompleted = deriveInitialStateFromSearchData({
    status: 'COMPLETED',
    creators: [],
  });

  expectEqual(
    emptyCompleted,
    { creators: [], isLoading: false },
    'should mark completed runs as loaded even when no creators returned'
  );

  const incomplete = deriveInitialStateFromSearchData({
    status: 'processing',
    creators: [{ id: '1' }],
  });

  expectEqual(
    incomplete,
    { creators: [], isLoading: true },
    'should defer to polling when status is not completed'
  );

  const empty = deriveInitialStateFromSearchData(undefined);
  expectEqual(
    empty,
    { creators: [], isLoading: true },
    'should default to loading when no data provided'
  );

  console.log('\u2705 similar-search init tests passed');
})();
