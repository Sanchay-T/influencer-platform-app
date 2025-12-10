/**
 * Async Queue - Producer/Consumer Pattern
 *
 * A bounded async queue that allows multiple producers and consumers.
 * - Producers push items (blocks if queue is full)
 * - Consumers pop items (blocks if queue is empty)
 * - Can be closed to signal completion
 */

export class AsyncQueue<T> {
	private queue: T[] = [];
	private readonly maxSize: number;
	private closed = false;

	// Waiting consumers (when queue is empty)
	private waitingConsumers: Array<{
		resolve: (value: T | null) => void;
		reject: (error: Error) => void;
	}> = [];

	// Waiting producers (when queue is full)
	private waitingProducers: Array<{
		item: T;
		resolve: () => void;
		reject: (error: Error) => void;
	}> = [];

	constructor(maxSize = 100) {
		this.maxSize = maxSize;
	}

	/**
	 * Push an item to the queue
	 * Blocks if queue is full, resolves when item is added
	 */
	async push(item: T): Promise<void> {
		if (this.closed) {
			throw new Error('Queue is closed');
		}

		// If there are waiting consumers, give directly to them
		if (this.waitingConsumers.length > 0) {
			const consumer = this.waitingConsumers.shift()!;
			consumer.resolve(item);
			return;
		}

		// If queue has space, add directly
		if (this.queue.length < this.maxSize) {
			this.queue.push(item);
			return;
		}

		// Queue is full, wait for space
		return new Promise((resolve, reject) => {
			this.waitingProducers.push({ item, resolve, reject });
		});
	}

	/**
	 * Pop an item from the queue
	 * Blocks if queue is empty, returns null if queue is closed and empty
	 */
	async pop(): Promise<T | null> {
		// If there are items in queue, return one
		if (this.queue.length > 0) {
			const item = this.queue.shift()!;

			// If there are waiting producers, let one in
			if (this.waitingProducers.length > 0) {
				const producer = this.waitingProducers.shift()!;
				this.queue.push(producer.item);
				producer.resolve();
			}

			return item;
		}

		// If there are waiting producers, take directly from them
		if (this.waitingProducers.length > 0) {
			const producer = this.waitingProducers.shift()!;
			producer.resolve();
			return producer.item;
		}

		// Queue is empty and closed
		if (this.closed) {
			return null;
		}

		// Queue is empty, wait for items
		return new Promise((resolve, reject) => {
			this.waitingConsumers.push({ resolve, reject });
		});
	}

	/**
	 * Close the queue - no more items can be pushed
	 * Waiting consumers will receive null
	 */
	close(): void {
		this.closed = true;

		// Resolve all waiting consumers with null
		for (const consumer of this.waitingConsumers) {
			consumer.resolve(null);
		}
		this.waitingConsumers = [];

		// Reject all waiting producers
		for (const producer of this.waitingProducers) {
			producer.reject(new Error('Queue closed while waiting to push'));
		}
		this.waitingProducers = [];
	}

	/**
	 * Check if queue is closed
	 */
	isClosed(): boolean {
		return this.closed;
	}

	/**
	 * Get current queue size
	 */
	size(): number {
		return this.queue.length;
	}

	/**
	 * Check if queue is empty
	 */
	isEmpty(): boolean {
		return this.queue.length === 0 && this.waitingProducers.length === 0;
	}
}

/**
 * Atomic counter for thread-safe counting
 */
export class AtomicCounter {
	private value: number;
	private readonly target: number;

	constructor(target: number, initial = 0) {
		this.target = target;
		this.value = initial;
	}

	/**
	 * Try to increment counter
	 * Returns true if increment was allowed (under target)
	 * Returns false if target already reached
	 */
	tryIncrement(): boolean {
		if (this.value >= this.target) {
			return false;
		}
		this.value++;
		return true;
	}

	/**
	 * Get current value
	 */
	get(): number {
		return this.value;
	}

	/**
	 * Check if target reached
	 */
	isComplete(): boolean {
		return this.value >= this.target;
	}

	/**
	 * Get remaining count
	 */
	remaining(): number {
		return Math.max(0, this.target - this.value);
	}

	/**
	 * Get target
	 */
	getTarget(): number {
		return this.target;
	}
}
