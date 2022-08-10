import { type TransformCallback, Transform } from 'node:stream';
import { StringDecoder } from 'node:string_decoder';

type LineStreamOptions = {
  readonly encoding?: BufferEncoding;
  readonly highWaterMark?: number;
  readonly transform?: (line: string) => string;
};

class LineStream extends Transform {
  // eslint-disable-next-line functional/prefer-readonly-type
  private _buffer = '';
  private readonly _decoder = new StringDecoder('utf8');
  private readonly _transformLine: (line: string) => string;

  constructor({ transform = (line) => line, encoding = 'utf8', ...options }: LineStreamOptions = {}) {
    super({ ...options, encoding });
    this._transformLine = transform;
  }

  _transform(chunk: any, _encoding: BufferEncoding, callback: TransformCallback): void {
    const lines = this._decoder.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))).split(/\r?\n/);

    lines[0] = this._buffer + lines[0];
    this._buffer = lines.pop() ?? '';
    lines.forEach((line) => this.push(this._transformLine(line), 'utf8'));
    callback();
  }

  _flush(callback: TransformCallback): void {
    this._buffer += this._decoder.end();

    if (this._buffer) {
      this.push(this._transformLine(this._buffer), 'utf8');
    }

    callback();
  }
}

export { LineStream };
