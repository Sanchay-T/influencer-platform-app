declare module 'heic-convert' {
	export type HeicConvertFormat = 'JPEG' | 'PNG';

	export interface HeicConvertOptions {
		buffer: ArrayBuffer | Uint8Array | Buffer;
		format: HeicConvertFormat;
		quality?: number;
	}

	export default function convert(
		options: HeicConvertOptions
	): Promise<ArrayBuffer | Uint8Array | Buffer>;
}
