var ArrayBufferReader = /** @class */ (function () {
    function ArrayBufferReader(buffer) {
        this.buffer = buffer;
        this.int32Array = new Uint32Array(buffer);
        this.offset = 0;
    }
    ArrayBufferReader.prototype.getUint32 = function () {
        var ret = this.int32Array[this.offset / 4]; //this is the trick for fetching the correct uint32 value
        this.offset += 4;
        return ret;
    };
    ArrayBufferReader.prototype.getUint16Array = function (len) {
        var ret = new Uint16Array(this.buffer, this.offset, len);
        this.offset += Uint16Array.BYTES_PER_ELEMENT * len;
        return ret;
    };
    ArrayBufferReader.prototype.getUint32Array = function (len) {
        var ret = new Uint32Array(this.buffer, this.offset, len);
        this.offset += Uint32Array.BYTES_PER_ELEMENT * len;
        return ret;
    };
    ArrayBufferReader.prototype.getFloat32Array = function (len) {
        var ret = new Float32Array(this.buffer, this.offset, len);
        this.offset += Float32Array.BYTES_PER_ELEMENT * len;
        return ret;
    };
    return ArrayBufferReader;
}());