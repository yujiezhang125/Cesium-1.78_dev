import Cartesian3 from "../Core/Cartesian3.js";
import Color from "../Core/Color.js";
import ComponentDatatype from "../Core/ComponentDatatype.js";
import defaultValue from "../Core/defaultValue.js";
import defined from "../Core/defined.js";
import deprecationWarning from "../Core/deprecationWarning.js";
import destroyObject from "../Core/destroyObject.js";
import DeveloperError from "../Core/DeveloperError.js";
import getStringFromTypedArray from "../Core/getStringFromTypedArray.js";
import Matrix4 from "../Core/Matrix4.js";
import RequestType from "../Core/RequestType.js";
import RuntimeError from "../Core/RuntimeError.js";
import Pass from "../Renderer/Pass.js";
import Axis from "./Axis.js";
import Cesium3DTileBatchTable from "./Cesium3DTileBatchTable.js";
import Cesium3DTileFeature from "./Cesium3DTileFeature.js";
import Cesium3DTileFeatureTable from "./Cesium3DTileFeatureTable.js";
import ClassificationModel from "./ClassificationModel.js";
import Model from "./Model.js";
import ModelUtility from "./ModelUtility.js";
import ModelAnimationLoop from "./ModelAnimationLoop.js";
// jadd
import * as Three from "../ThirdParty/three.js";
import * as THREE from "../ThirdParty/three.module.js";
import { GLTFExporter } from '../ThirdParty/GLTFExporter.js'
// jadd end

/**
 * Represents the contents of a
 * {@link https://github.com/CesiumGS/3d-tiles/tree/master/specification/TileFormats/Batched3DModel|Batched 3D Model}
 * tile in a {@link https://github.com/CesiumGS/3d-tiles/tree/master/specification|3D Tiles} tileset.
 * <p>
 * Implements the {@link Cesium3DTileContent} interface.
 * </p>
 *
 * @alias Batched3DModel3DTileContent
 * @constructor
 *
 * @private
 */
function Batched3DModel3DTileContent(
  tileset,
  tile,
  resource,
  arrayBuffer,
  byteOffset
) {
  this._tileset = tileset;
  this._tile = tile;
  this._resource = resource;
  this._model = undefined;
  this._batchTable = undefined;
  this._features = undefined;

  // Populate from gltf when available
  this._batchIdAttributeName = undefined;
  this._diffuseAttributeOrUniformName = {};

  this._rtcCenterTransform = undefined;
  this._contentModelMatrix = undefined;

  this.featurePropertiesDirty = false;

  // jadd
  if (byteOffset != 123.456){
    initialize(this, arrayBuffer, byteOffset);
  } else {
    initialize_ogl(this, arrayBuffer, 0);
  }
  // jadd end
}

// This can be overridden for testing purposes
Batched3DModel3DTileContent._deprecationWarning = deprecationWarning;

Object.defineProperties(Batched3DModel3DTileContent.prototype, {
  featuresLength: {
    get: function () {
      return this._batchTable.featuresLength;
    },
  },

  pointsLength: {
    get: function () {
      return 0;
    },
  },

  trianglesLength: {
    get: function () {
      return this._model.trianglesLength;
    },
  },

  geometryByteLength: {
    get: function () {
      return this._model.geometryByteLength;
    },
  },

  texturesByteLength: {
    get: function () {
      return this._model.texturesByteLength;
    },
  },

  batchTableByteLength: {
    get: function () {
      return this._batchTable.memorySizeInBytes;
    },
  },

  innerContents: {
    get: function () {
      return undefined;
    },
  },

  readyPromise: {
    get: function () {
      return this._model.readyPromise;
    },
  },

  tileset: {
    get: function () {
      return this._tileset;
    },
  },

  tile: {
    get: function () {
      return this._tile;
    },
  },

  url: {
    get: function () {
      return this._resource.getUrlComponent(true);
    },
  },

  batchTable: {
    get: function () {
      return this._batchTable;
    },
  },
});

var sizeOfUint32 = Uint32Array.BYTES_PER_ELEMENT;

function getBatchIdAttributeName(gltf) {
  var batchIdAttributeName = ModelUtility.getAttributeOrUniformBySemantic(
    gltf,
    "_BATCHID"
  );
  if (!defined(batchIdAttributeName)) {
    batchIdAttributeName = ModelUtility.getAttributeOrUniformBySemantic(
      gltf,
      "BATCHID"
    );
    if (defined(batchIdAttributeName)) {
      Batched3DModel3DTileContent._deprecationWarning(
        "b3dm-legacy-batchid",
        "The glTF in this b3dm uses the semantic `BATCHID`. Application-specific semantics should be prefixed with an underscore: `_BATCHID`."
      );
    }
  }
  return batchIdAttributeName;
}

function getVertexShaderCallback(content) {
  return function (vs, programId) {
    var batchTable = content._batchTable;
    var handleTranslucent = !defined(content._tileset.classificationType);

    var gltf = content._model.gltf;
    if (defined(gltf)) {
      content._batchIdAttributeName = getBatchIdAttributeName(gltf);
      content._diffuseAttributeOrUniformName[
        programId
      ] = ModelUtility.getDiffuseAttributeOrUniform(gltf, programId);
    }

    var callback = batchTable.getVertexShaderCallback(
      handleTranslucent,
      content._batchIdAttributeName,
      content._diffuseAttributeOrUniformName[programId]
    );
    return defined(callback) ? callback(vs) : vs;
  };
}

function getFragmentShaderCallback(content) {
  return function (fs, programId) {
    var batchTable = content._batchTable;
    var handleTranslucent = !defined(content._tileset.classificationType);

    var gltf = content._model.gltf;
    if (defined(gltf)) {
      content._diffuseAttributeOrUniformName[
        programId
      ] = ModelUtility.getDiffuseAttributeOrUniform(gltf, programId);
    }
    var callback = batchTable.getFragmentShaderCallback(
      handleTranslucent,
      content._diffuseAttributeOrUniformName[programId]
    );
    return defined(callback) ? callback(fs) : fs;
  };
}

function getPickIdCallback(content) {
  return function () {
    return content._batchTable.getPickId();
  };
}

function getClassificationFragmentShaderCallback(content) {
  return function (fs) {
    var batchTable = content._batchTable;
    var callback = batchTable.getClassificationFragmentShaderCallback();
    return defined(callback) ? callback(fs) : fs;
  };
}

function createColorChangedCallback(content) {
  return function (batchId, color) {
    content._model.updateCommands(batchId, color);
  };
}

function initialize(content, arrayBuffer, byteOffset) {
  var tileset = content._tileset;
  var tile = content._tile;
  var resource = content._resource;

  var byteStart = defaultValue(byteOffset, 0);
  byteOffset = byteStart;

  var uint8Array = new Uint8Array(arrayBuffer);
  var view = new DataView(arrayBuffer);
  byteOffset += sizeOfUint32; // Skip magic

  var version = view.getUint32(byteOffset, true);
  if (version !== 1) {
    throw new RuntimeError(
      "Only Batched 3D Model version 1 is supported.  Version " +
        version +
        " is not."
    );
  }
  byteOffset += sizeOfUint32;

  var byteLength = view.getUint32(byteOffset, true);
  byteOffset += sizeOfUint32;

  var featureTableJsonByteLength = view.getUint32(byteOffset, true);
  byteOffset += sizeOfUint32;

  var featureTableBinaryByteLength = view.getUint32(byteOffset, true);
  byteOffset += sizeOfUint32;

  var batchTableJsonByteLength = view.getUint32(byteOffset, true);
  byteOffset += sizeOfUint32;

  var batchTableBinaryByteLength = view.getUint32(byteOffset, true);
  byteOffset += sizeOfUint32;

  var batchLength;

  // Legacy header #1: [batchLength] [batchTableByteLength]
  // Legacy header #2: [batchTableJsonByteLength] [batchTableBinaryByteLength] [batchLength]
  // Current header: [featureTableJsonByteLength] [featureTableBinaryByteLength] [batchTableJsonByteLength] [batchTableBinaryByteLength]
  // If the header is in the first legacy format 'batchTableJsonByteLength' will be the start of the JSON string (a quotation mark) or the glTF magic.
  // Accordingly its first byte will be either 0x22 or 0x67, and so the minimum uint32 expected is 0x22000000 = 570425344 = 570MB. It is unlikely that the feature table JSON will exceed this length.
  // The check for the second legacy format is similar, except it checks 'batchTableBinaryByteLength' instead
  if (batchTableJsonByteLength >= 570425344) {
    // First legacy check
    byteOffset -= sizeOfUint32 * 2;
    batchLength = featureTableJsonByteLength;
    batchTableJsonByteLength = featureTableBinaryByteLength;
    batchTableBinaryByteLength = 0;
    featureTableJsonByteLength = 0;
    featureTableBinaryByteLength = 0;
    Batched3DModel3DTileContent._deprecationWarning(
      "b3dm-legacy-header",
      "This b3dm header is using the legacy format [batchLength] [batchTableByteLength]. The new format is [featureTableJsonByteLength] [featureTableBinaryByteLength] [batchTableJsonByteLength] [batchTableBinaryByteLength] from https://github.com/CesiumGS/3d-tiles/tree/master/specification/TileFormats/Batched3DModel."
    );
  } else if (batchTableBinaryByteLength >= 570425344) {
    // Second legacy check
    byteOffset -= sizeOfUint32;
    batchLength = batchTableJsonByteLength;
    batchTableJsonByteLength = featureTableJsonByteLength;
    batchTableBinaryByteLength = featureTableBinaryByteLength;
    featureTableJsonByteLength = 0;
    featureTableBinaryByteLength = 0;
    Batched3DModel3DTileContent._deprecationWarning(
      "b3dm-legacy-header",
      "This b3dm header is using the legacy format [batchTableJsonByteLength] [batchTableBinaryByteLength] [batchLength]. The new format is [featureTableJsonByteLength] [featureTableBinaryByteLength] [batchTableJsonByteLength] [batchTableBinaryByteLength] from https://github.com/CesiumGS/3d-tiles/tree/master/specification/TileFormats/Batched3DModel."
    );
  }

  var featureTableJson;
  if (featureTableJsonByteLength === 0) {
    featureTableJson = {
      BATCH_LENGTH: defaultValue(batchLength, 0),
    };
  } else {
    var featureTableString = getStringFromTypedArray(
      uint8Array,
      byteOffset,
      featureTableJsonByteLength
    );
    featureTableJson = JSON.parse(featureTableString);
    byteOffset += featureTableJsonByteLength;
  }

  var featureTableBinary = new Uint8Array(
    arrayBuffer,
    byteOffset,
    featureTableBinaryByteLength
  );
  byteOffset += featureTableBinaryByteLength;

  var featureTable = new Cesium3DTileFeatureTable(
    featureTableJson,
    featureTableBinary
  );

  batchLength = featureTable.getGlobalProperty("BATCH_LENGTH");
  featureTable.featuresLength = batchLength;

  var batchTableJson;
  var batchTableBinary;
  if (batchTableJsonByteLength > 0) {
    // PERFORMANCE_IDEA: is it possible to allocate this on-demand?  Perhaps keep the
    // arraybuffer/string compressed in memory and then decompress it when it is first accessed.
    //
    // We could also make another request for it, but that would make the property set/get
    // API async, and would double the number of numbers in some cases.
    var batchTableString = getStringFromTypedArray(
      uint8Array,
      byteOffset,
      batchTableJsonByteLength
    );
    batchTableJson = JSON.parse(batchTableString);
    byteOffset += batchTableJsonByteLength;

    if (batchTableBinaryByteLength > 0) {
      // Has a batch table binary
      batchTableBinary = new Uint8Array(
        arrayBuffer,
        byteOffset,
        batchTableBinaryByteLength
      );
      // Copy the batchTableBinary section and let the underlying ArrayBuffer be freed
      batchTableBinary = new Uint8Array(batchTableBinary);
      byteOffset += batchTableBinaryByteLength;
    }
  }

  var colorChangedCallback;
  if (defined(tileset.classificationType)) {
    colorChangedCallback = createColorChangedCallback(content);
  }

  var batchTable = new Cesium3DTileBatchTable(
    content,
    batchLength,
    batchTableJson,
    batchTableBinary,
    colorChangedCallback
  );
  content._batchTable = batchTable;

  var gltfByteLength = byteStart + byteLength - byteOffset;
  if (gltfByteLength === 0) {
    throw new RuntimeError("glTF byte length must be greater than 0.");
  }

  var gltfView;
  if (byteOffset % 4 === 0) {
    gltfView = new Uint8Array(arrayBuffer, byteOffset, gltfByteLength);
  } else {
    // Create a copy of the glb so that it is 4-byte aligned
    Batched3DModel3DTileContent._deprecationWarning(
      "b3dm-glb-unaligned",
      "The embedded glb is not aligned to a 4-byte boundary."
    );
    gltfView = new Uint8Array(
      uint8Array.subarray(byteOffset, byteOffset + gltfByteLength)
    );
  }

  var pickObject = {
    content: content,
    primitive: tileset,
  };

  content._rtcCenterTransform = Matrix4.IDENTITY;
  var rtcCenter = featureTable.getGlobalProperty(
    "RTC_CENTER",
    ComponentDatatype.FLOAT,
    3
  );
  if (defined(rtcCenter)) {
    content._rtcCenterTransform = Matrix4.fromTranslation(
      Cartesian3.fromArray(rtcCenter)
    );
  }

  content._contentModelMatrix = Matrix4.multiply(
    tile.computedTransform,
    content._rtcCenterTransform,
    new Matrix4()
  );

  if (!defined(tileset.classificationType)) {
    // PERFORMANCE_IDEA: patch the shader on demand, e.g., the first time show/color changes.
    // The pick shader still needs to be patched.
    content._model = new Model({
      gltf: gltfView,
      cull: false, // The model is already culled by 3D Tiles
      releaseGltfJson: true, // Models are unique and will not benefit from caching so save memory
      opaquePass: Pass.CESIUM_3D_TILE, // Draw opaque portions of the model during the 3D Tiles pass
      basePath: resource,
      requestType: RequestType.TILES3D,
      modelMatrix: content._contentModelMatrix,
      upAxis: tileset._gltfUpAxis,
      forwardAxis: Axis.X,
      shadows: tileset.shadows,
      debugWireframe: tileset.debugWireframe,
      incrementallyLoadTextures: false,
      vertexShaderLoaded: getVertexShaderCallback(content),
      fragmentShaderLoaded: getFragmentShaderCallback(content),
      uniformMapLoaded: batchTable.getUniformMapCallback(),
      pickIdLoaded: getPickIdCallback(content),
      addBatchIdToGeneratedShaders: batchLength > 0, // If the batch table has values in it, generated shaders will need a batchId attribute
      pickObject: pickObject,
      imageBasedLightingFactor: tileset.imageBasedLightingFactor,
      lightColor: tileset.lightColor,
      luminanceAtZenith: tileset.luminanceAtZenith,
      sphericalHarmonicCoefficients: tileset.sphericalHarmonicCoefficients,
      specularEnvironmentMaps: tileset.specularEnvironmentMaps,
      backFaceCulling: tileset.backFaceCulling,
    });
    content._model.readyPromise.then(function (model) {
      model.activeAnimations.addAll({
        loop: ModelAnimationLoop.REPEAT,
      });
    });
  } else {
    // This transcodes glTF to an internal representation for geometry so we can take advantage of the re-batching of vector data.
    // For a list of limitations on the input glTF, see the documentation for classificationType of Cesium3DTileset.
    content._model = new ClassificationModel({
      gltf: gltfView,
      cull: false, // The model is already culled by 3D Tiles
      basePath: resource,
      requestType: RequestType.TILES3D,
      modelMatrix: content._contentModelMatrix,
      upAxis: tileset._gltfUpAxis,
      forwardAxis: Axis.X,
      debugWireframe: tileset.debugWireframe,
      vertexShaderLoaded: getVertexShaderCallback(content),
      classificationShaderLoaded: getClassificationFragmentShaderCallback(
        content
      ),
      uniformMapLoaded: batchTable.getUniformMapCallback(),
      pickIdLoaded: getPickIdCallback(content),
      classificationType: tileset._classificationType,
      batchTable: batchTable,
    });
  }
}

// jadd
function initialize_ogl(content, arrayBuffer, byteOffset) {
  var tileset = content._tileset;
  var tile = content._tile;
  var resource = content._resource;

  var byteStart = defaultValue(byteOffset, 0);
  byteOffset = byteStart;

  var uint8Array = new Uint8Array(arrayBuffer);
  var view = new DataView(arrayBuffer);
  byteOffset += sizeOfUint32; // Skip magic

  // var version = view.getUint32(byteOffset, true);
  // if (version !== 1) {
  //   throw new RuntimeError(
  //     "Only Batched 3D Model version 1 is supported.  Version " +
  //       version +
  //       " is not."
  //   );
  // }
  byteOffset += sizeOfUint32;

  var byteLength = view.getUint32(byteOffset, true);
  byteOffset += sizeOfUint32;

  var featureTableJsonByteLength = view.getUint32(byteOffset, true);
  byteOffset += sizeOfUint32;

  var featureTableBinaryByteLength = view.getUint32(byteOffset, true);
  byteOffset += sizeOfUint32;

  var batchTableJsonByteLength = view.getUint32(byteOffset, true);
  byteOffset += sizeOfUint32;

  var batchTableBinaryByteLength = view.getUint32(byteOffset, true);
  byteOffset += sizeOfUint32;

  var batchLength;

  // Legacy header #1: [batchLength] [batchTableByteLength]
  // Legacy header #2: [batchTableJsonByteLength] [batchTableBinaryByteLength] [batchLength]
  // Current header: [featureTableJsonByteLength] [featureTableBinaryByteLength] [batchTableJsonByteLength] [batchTableBinaryByteLength]
  // If the header is in the first legacy format 'batchTableJsonByteLength' will be the start of the JSON string (a quotation mark) or the glTF magic.
  // Accordingly its first byte will be either 0x22 or 0x67, and so the minimum uint32 expected is 0x22000000 = 570425344 = 570MB. It is unlikely that the feature table JSON will exceed this length.
  // The check for the second legacy format is similar, except it checks 'batchTableBinaryByteLength' instead
  if (batchTableJsonByteLength >= 570425344) {
    // First legacy check
    byteOffset -= sizeOfUint32 * 2;
    batchLength = featureTableJsonByteLength;
    batchTableJsonByteLength = featureTableBinaryByteLength;
    batchTableBinaryByteLength = 0;
    featureTableJsonByteLength = 0;
    featureTableBinaryByteLength = 0;
    // Batched3DModel3DTileContent._deprecationWarning(
    //   "b3dm-legacy-header",
    //   "This b3dm header is using the legacy format [batchLength] [batchTableByteLength]. The new format is [featureTableJsonByteLength] [featureTableBinaryByteLength] [batchTableJsonByteLength] [batchTableBinaryByteLength] from https://github.com/CesiumGS/3d-tiles/tree/master/specification/TileFormats/Batched3DModel."
    // );
  } else if (batchTableBinaryByteLength >= 570425344) {
    // Second legacy check
    byteOffset -= sizeOfUint32;
    batchLength = batchTableJsonByteLength;
    batchTableJsonByteLength = featureTableJsonByteLength;
    batchTableBinaryByteLength = featureTableBinaryByteLength;
    featureTableJsonByteLength = 0;
    featureTableBinaryByteLength = 0;
    // Batched3DModel3DTileContent._deprecationWarning(
    //   "b3dm-legacy-header",
    //   "This b3dm header is using the legacy format [batchTableJsonByteLength] [batchTableBinaryByteLength] [batchLength]. The new format is [featureTableJsonByteLength] [featureTableBinaryByteLength] [batchTableJsonByteLength] [batchTableBinaryByteLength] from https://github.com/CesiumGS/3d-tiles/tree/master/specification/TileFormats/Batched3DModel."
    // );
  }

  var featureTableJson;
  if (featureTableJsonByteLength === 0) {
    featureTableJson = {
      BATCH_LENGTH: defaultValue(batchLength, 0),
    };
  } else {
    var featureTableString = getStringFromTypedArray(
      uint8Array,
      byteOffset,
      featureTableJsonByteLength
    );
    featureTableJson = JSON.parse(featureTableString);
    byteOffset += featureTableJsonByteLength;
  }

  var featureTableBinary = new Uint8Array(
    arrayBuffer,
    byteOffset,
    featureTableBinaryByteLength
  );
  byteOffset += featureTableBinaryByteLength;

  var featureTable = new Cesium3DTileFeatureTable(
    featureTableJson,
    featureTableBinary
  );

  batchLength = featureTable.getGlobalProperty("BATCH_LENGTH");
  featureTable.featuresLength = batchLength;

  var batchTableJson;
  var batchTableBinary;
  // if (batchTableJsonByteLength > 0) {
  //   // PERFORMANCE_IDEA: is it possible to allocate this on-demand?  Perhaps keep the
  //   // arraybuffer/string compressed in memory and then decompress it when it is first accessed.
  //   //
  //   // We could also make another request for it, but that would make the property set/get
  //   // API async, and would double the number of numbers in some cases.
  //   var batchTableString = getStringFromTypedArray(
  //     uint8Array,
  //     byteOffset,
  //     batchTableJsonByteLength
  //   );
  //   batchTableJson = JSON.parse(batchTableString);
  //   byteOffset += batchTableJsonByteLength;

  //   if (batchTableBinaryByteLength > 0) {
  //     // Has a batch table binary
  //     batchTableBinary = new Uint8Array(
  //       arrayBuffer,
  //       byteOffset,
  //       batchTableBinaryByteLength
  //     );
  //     // Copy the batchTableBinary section and let the underlying ArrayBuffer be freed
  //     batchTableBinary = new Uint8Array(batchTableBinary);
  //     byteOffset += batchTableBinaryByteLength;
  //   }
  // }

  var colorChangedCallback;
  if (defined(tileset.classificationType)) {
    colorChangedCallback = createColorChangedCallback(content);
  }

  var batchTable = new Cesium3DTileBatchTable(
    content,
    batchLength,
    batchTableJson,
    batchTableBinary,
    colorChangedCallback
  );
  content._batchTable = batchTable;

  // var gltfByteLength = byteStart + byteLength - byteOffset;
  // if (gltfByteLength === 0) {
  //   throw new RuntimeError("glTF byte length must be greater than 0.");
  // }

  var gltfView;
  // if (byteOffset % 4 === 0) {
  //   gltfView = new Uint8Array(arrayBuffer, byteOffset, gltfByteLength);
  // } else {
  //   // Create a copy of the glb so that it is 4-byte aligned
  //   Batched3DModel3DTileContent._deprecationWarning(
  //     "b3dm-glb-unaligned",
  //     "The embedded glb is not aligned to a 4-byte boundary."
  //   );
  //   gltfView = new Uint8Array(
  //     uint8Array.subarray(byteOffset, byteOffset + gltfByteLength)
  //   );
  // }

  // gltfView = JSON.parse("{\n  \"asset\": {\n    \"version\": \"2.0\",\n    \"generator\": \"THREE.GLTFExporter\"\n  },\n  \"scenes\": [\n    {\n      \"name\": \"AuxScene\",\n      \"nodes\": [\n        0\n      ]\n    }\n  ],\n  \"scene\": 0,\n  \"nodes\": [\n    {\n      \"name\": \"Sphere\",\n      \"mesh\": 0\n    }\n  ],\n  \"bufferViews\": [\n    {\n      \"buffer\": 0,\n      \"byteOffset\": 0,\n      \"byteLength\": 1452,\n      \"target\": 34962,\n      \"byteStride\": 12\n    },\n    {\n      \"buffer\": 0,\n      \"byteOffset\": 1452,\n      \"byteLength\": 1452,\n      \"target\": 34962,\n      \"byteStride\": 12\n    },\n    {\n      \"buffer\": 0,\n      \"byteOffset\": 2904,\n      \"byteLength\": 968,\n      \"target\": 34962,\n      \"byteStride\": 8\n    },\n    {\n      \"buffer\": 0,\n      \"byteOffset\": 3872,\n      \"byteLength\": 1080,\n      \"target\": 34963\n    }\n  ],\n  \"buffers\": [\n    {\n      \"byteLength\": 4952,\n      \"uri\": \"data:application/octet-stream;base64,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AACAP5qZmT4AAAAAzcxMPs3MzD3NzEw+zcxMPs3MTD6amZk+zcxMPs3MzD7NzEw+AAAAP83MTD6amRk/zcxMPjMzMz/NzEw+zcxMP83MTD5mZmY/zcxMPgAAgD/NzEw+AAAAAM3MzD3NzMw9zczMPc3MTD7NzMw9mpmZPs3MzD3NzMw+zczMPQAAAD/NzMw9mpkZP83MzD0zMzM/zczMPc3MTD/NzMw9ZmZmP83MzD0AAIA/zczMPc3MTL0AAAAAzcxMPQAAAACamRk+AAAAAAAAgD4AAAAAMzOzPgAAAABmZuY+AAAAAM3MDD8AAAAAZmYmPwAAAAAAAEA/AAAAAJqZWT8AAAAAMzNzPwAAAAAAAAsADAABAAwADQACAA0ADgADAA4ADwAEAA8AEAAFABAAEQAGABEAEgAHABIAEwAIABMAFAAJABQAFQAMAAsAFwALABYAFwANAAwAGAAMABcAGAAOAA0AGQANABgAGQAPAA4AGgAOABkAGgAQAA8AGwAPABoAGwARABAAHAAQABsAHAASABEAHQARABwAHQATABIAHgASAB0AHgAUABMAHwATAB4AHwAVABQAIAAUAB8AIAAXABYAIgAWACEAIgAYABcAIwAXACIAIwAZABgAJAAYACMAJAAaABkAJQAZACQAJQAbABoAJgAaACUAJgAcABsAJwAbACYAJwAdABwAKAAcACcAKAAeAB0AKQAdACgAKQAfAB4AKgAeACkAKgAgAB8AKwAfACoAKwAiACEALQAhACwALQAjACIALgAiAC0ALgAkACMALwAjAC4ALwAlACQAMAAkAC8AMAAmACUAMQAlADAAMQAnACYAMgAmADEAMgAoACcAMwAnADIAMwApACgANAAoADMANAAqACkANQApADQANQArACoANgAqADUANgAtACwAOAAsADcAOAAuAC0AOQAtADgAOQAvAC4AOgAuADkAOgAwAC8AOwAvADoAOwAxADAAPAAwADsAPAAyADEAPQAxADwAPQAzADIAPgAyAD0APgA0ADMAPwAzAD4APwA1ADQAQAA0AD8AQAA2ADUAQQA1AEAAQQA4ADcAQwA3AEIAQwA5ADgARAA4AEMARAA6ADkARQA5AEQARQA7ADoARgA6AEUARgA8ADsARwA7AEYARwA9ADwASAA8AEcASAA+AD0ASQA9AEgASQA/AD4ASgA+AEkASgBAAD8ASwA/AEoASwBBAEAATABAAEsATABDAEIATgBCAE0ATgBEAEMATwBDAE4ATwBFAEQAUABEAE8AUABGAEUAUQBFAFAAUQBHAEYAUgBGAFEAUgBIAEcAUwBHAFIAUwBJAEgAVABIAFMAVABKAEkAVQBJAFQAVQBLAEoAVgBKAFUAVgBMAEsAVwBLAFYAVwBOAE0AWQBNAFgAWQBPAE4AWgBOAFkAWgBQAE8AWwBPAFoAWwBRAFAAXABQAFsAXABSAFEAXQBRAFwAXQBTAFIAXgBSAF0AXgBUAFMAXwBTAF4AXwBVAFQAYABUAF8AYABWAFUAYQBVAGAAYQBXAFYAYgBWAGEAYgBZAFgAZABYAGMAZABaAFkAZQBZAGQAZQBbAFoAZgBaAGUAZgBcAFsAZwBbAGYAZwBdAFwAaABcAGcAaABeAF0AaQBdAGgAaQBfAF4AagBeAGkAagBgAF8AawBfAGoAawBhAGAAbABgAGsAbABiAGEAbQBhAGwAbQBkAGMAbwBlAGQAcABmAGUAcQBnAGYAcgBoAGcAcwBpAGgAdABqAGkAdQBrAGoAdgBsAGsAdwBtAGwAeAA=\"\n    }\n  ],\n  \"accessors\": [\n    {\n      \"bufferView\": 0,\n      \"componentType\": 5126,\n      \"count\": 121,\n      \"max\": [\n        70,\n        70,\n        66.57395935058594\n      ],\n      \"min\": [\n        -70,\n        -70,\n        -66.57395935058594\n      ],\n      \"type\": \"VEC3\"\n    },\n    {\n      \"bufferView\": 1,\n      \"componentType\": 5126,\n      \"count\": 121,\n      \"max\": [\n        1,\n        1,\n        0.9510565400123596\n      ],\n      \"min\": [\n        -1,\n        -1,\n        -0.9510565400123596\n      ],\n      \"type\": \"VEC3\"\n    },\n    {\n      \"bufferView\": 2,\n      \"componentType\": 5126,\n      \"count\": 121,\n      \"max\": [\n        1.0499999523162842,\n        1\n      ],\n      \"min\": [\n        -0.05000000074505806,\n        0\n      ],\n      \"type\": \"VEC2\"\n    },\n    {\n      \"bufferView\": 3,\n      \"componentType\": 5123,\n      \"count\": 540,\n      \"max\": [\n        120\n      ],\n      \"min\": [\n        0\n      ],\n      \"type\": \"SCALAR\"\n    }\n  ],\n  \"materials\": [\n    {\n      \"pbrMetallicRoughness\": {\n        \"baseColorFactor\": [\n          1,\n          1,\n          0,\n          1\n        ],\n        \"metallicFactor\": 0.5,\n        \"roughnessFactor\": 1,\n        \"baseColorTexture\": {\n          \"index\": 0\n        }\n      }\n    }\n  ],\n  \"textures\": [\n    {\n      \"sampler\": 0,\n      \"source\": 0\n    }\n  ],\n  \"samplers\": [\n    {\n      \"magFilter\": 9729,\n      \"minFilter\": 9729,\n      \"wrapS\": 33071,\n      \"wrapT\": 33071\n    }\n  ],\n  \"images\": [\n    {\n      \"mimeType\": \"image/jpeg\",\n      \"uri\": \"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCABkAGQDASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAAAAQFBv/EABkQAAMBAQEAAAAAAAAAAAAAAAABE2FRAv/EABgBAQEBAQEAAAAAAAAAAAAAAAAHBQgE/8QAGhEBAAMAAwAAAAAAAAAAAAAAABMVYQESUf/aAAwDAQACEQMRAD8A7O76Lvpn3XRddOJonCVFjQu+i76Z910XXREUWNC76Lvpn3XRddERRY0Lvou+mfddF10RFFjQu+i76Z910XXREUWNC76Lvpn3XRddERRY0LvoM+66BEUWM++sX1kFtFtNKJZaLF99YvrILaLaIiixffWL6yC2i2iIosX31i+sgtotoiKLF99YvrILaLaIiixffWL6yC2i2iIosX31ggtoERRYzr6xfWQXFzSiWSixffWL6yC4uIiixffWL6yC4uIiixffWL6yC4uIiixffWL6yC4uIiixffWL6yC4uIiixffWCC4ERRYz7i5n3FzSiWaixoXFzPuLiIosaFxcz7i4iKLGhcXM+4uIiixoXFzPuLiIosaFxcz7i4iKLGhcGfcCIosZ9xcgvqF9RpRLLRYvuLkF9QvqERRYvuLkF9QvqERRYvuLkF9QvqERRYvuLkF9QvqERRYvuLkF9QvqERRYvuCC+oCIosZ1tFtIL6hfUaMSy0WL7aLaQX1C+oRFFi+2i2kF9QvqERRYvtotpBfUL6hEUWL7aLaQX1C+oRFFi+2i2kF9QvqERRYvtoIL6gIiixDT10U9dAPYofXjwp66KeugA68eFPXRT10AHXjwp66KeugA68eFPXRT10AHXjwp66KeugA68eFPXQADrx4//9k=\"\n    }\n  ],\n  \"meshes\": [\n    {\n      \"primitives\": [\n        {\n          \"mode\": 4,\n          \"attributes\": {\n            \"POSITION\": 0,\n            \"NORMAL\": 1,\n            \"TEXCOORD_0\": 2\n          },\n          \"indices\": 3,\n          \"material\": 0\n        }\n      ]\n    }\n  ]\n}");
  
  // ogl转为geometry, 构成mesh, 导出为gltf
  const threeGeometry = oglParserFunction(arrayBuffer);
  const threeMaterial = new THREE.MeshBasicMaterial( { color: 0xffff00 } );
  const threeMesh = new THREE.Mesh(threeGeometry, threeMaterial);
  const gltfExporter = new GLTFExporter();
  var gltfJson = gltfExporter.parse( threeMesh, function ( result ) {

    if ( result instanceof ArrayBuffer ) {

      console.log( '?arraybuffer?' );
      // saveArrayBuffer( result, 'scene.glb' );

    } else {

      const output = JSON.stringify( result, null, 2 );
      console.log(output);
      gltfView = output;
      return output;
      // saveString( output, 'scene.gltf' );

    }

  });
  gltfView = "{\n  \"asset\": {\n    \"version\": \"2.0\",\n    \"generator\": \"THREE.GLTFExporter\"\n  },\n  \"scenes\": [\n    {\n      \"name\": \"AuxScene\",\n      \"nodes\": [\n        0\n      ]\n    }\n  ],\n  \"scene\": 0,\n  \"nodes\": [\n    {\n      \"mesh\": 0\n    }\n  ],\n  \"bufferViews\": [\n    {\n      \"buffer\": 0,\n      \"byteOffset\": 0,\n      \"byteLength\": 288,\n      \"target\": 34962,\n      \"byteStride\": 12\n    },\n    {\n      \"buffer\": 0,\n      \"byteOffset\": 288,\n      \"byteLength\": 288,\n      \"target\": 34962,\n      \"byteStride\": 12\n    },\n    {\n      \"buffer\": 0,\n      \"byteOffset\": 576,\n      \"byteLength\": 192,\n      \"target\": 34962,\n      \"byteStride\": 8\n    },\n    {\n      \"buffer\": 0,\n      \"byteOffset\": 768,\n      \"byteLength\": 72,\n      \"target\": 34963\n    }\n  ],\n  \"buffers\": [\n    {\n      \"byteLength\": 840,\n      \"uri\": \"data:application/octet-stream;base64,rkdDQQEAQD8rXA8+r0dDwQEAQD8rXA8+r0dDwQAAQL8rXA8+rkdDQQAAQL8rXA8+rkdDQQEAQD8sXA++rkdDQQAAQL8sXA++r0dDwQAAQL8sXA++r0dDwQEAQD8sXA++r0dDwQEAQD8rXA8+rkdDQQEAQD8rXA8+rkdDQQEAQD8sXA++r0dDwQEAQD8sXA++rkdDQQAAQL8rXA8+r0dDwQAAQL8rXA8+r0dDwQAAQL8sXA++rkdDQQAAQL8sXA++rkdDQQEAQD8rXA8+rkdDQQAAQL8rXA8+rkdDQQAAQL8sXA++rkdDQQEAQD8sXA++r0dDwQAAQL8rXA8+r0dDwQEAQD8rXA8+r0dDwQEAQD8sXA++r0dDwQAAQL8sXA++MD/UpAAAAAAAAIA/MD/UpAAAAAAAAIA/MD/UpAAAAAAAAIA/MD/UpAAAAAAAAIA/MD/UJAAAAAAAAIC/MD/UJAAAAAAAAIC/MD/UJAAAAAAAAIC/MD/UJAAAAAAAAIC/AAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAgL8AAAAAAACAPwAAAAAK3uOmAACAPwAAAAAK3uOmAACAPwAAAAAK3uOmAACAPwAAAAAK3uOmAACAvwAAAACcpd6nAACAvwAAAACcpd6nAACAvwAAAACcpd6nAACAvwAAAACcpd6nVlUVPwAAyMBWlcxCAADIwFaVzEIAAAAAVlUVPwAAAABWVRW/AADIwFZVFb8AAAAAVpXMwgAAAABWlczCAADIwFaVzEJWVRU/VlUVP1ZVFT9WVRU/VlUVv1aVzEJWVRW/VlUVP1ZVFb9WlcxCVlUVv1aVzEJWVRU/VlUVP1ZVFT9WVRU/AADIwFZVFT8AAAAAVlUVvwAAAABWVRW/AADIwFZVFb8AAAAAVlUVvwAAyMBWVRU/AADIwFZVFT8AAAAAAwAAAAIAAQACAAAABgAHAAUABAAFAAcACAAJAAoACgALAAgADAANAA4ADgAPAAwAEwAQABEAEQASABMAFQAWABcAFwAUABUA\"\n    }\n  ],\n  \"accessors\": [\n    {\n      \"bufferView\": 0,\n      \"componentType\": 5126,\n      \"count\": 24,\n      \"max\": [\n        12.204999923706055,\n        0.7500000596046448,\n        0.14000003039836884\n      ],\n      \"min\": [\n        -12.205000877380371,\n        -0.75,\n        -0.14000004529953003\n      ],\n      \"type\": \"VEC3\"\n    },\n    {\n      \"bufferView\": 1,\n      \"componentType\": 5126,\n      \"count\": 24,\n      \"max\": [\n        1,\n        1,\n        1\n      ],\n      \"min\": [\n        -1,\n        -1,\n        -1\n      ],\n      \"type\": \"VEC3\"\n    },\n    {\n      \"bufferView\": 2,\n      \"componentType\": 5126,\n      \"count\": 24,\n      \"max\": [\n        102.29167175292969,\n        0.5833333730697632\n      ],\n      \"min\": [\n        -102.29167175292969,\n        -6.25\n      ],\n      \"type\": \"VEC2\"\n    },\n    {\n      \"bufferView\": 3,\n      \"componentType\": 5123,\n      \"count\": 36,\n      \"max\": [\n        23\n      ],\n      \"min\": [\n        0\n      ],\n      \"type\": \"SCALAR\"\n    }\n  ],\n  \"materials\": [\n    {\n      \"pbrMetallicRoughness\": {\n        \"baseColorFactor\": [\n          1,\n          1,\n          0,\n          1\n        ],\n        \"metallicFactor\": 0,\n        \"roughnessFactor\": 0.9\n      },\n      \"extensions\": {\n        \"KHR_materials_unlit\": {}\n      }\n    }\n  ],\n  \"meshes\": [\n    {\n      \"primitives\": [\n        {\n          \"mode\": 4,\n          \"attributes\": {\n            \"POSITION\": 0,\n            \"NORMAL\": 1,\n            \"TEXCOORD_0\": 2\n          },\n          \"indices\": 3,\n          \"material\": 0\n        }\n      ]\n    }\n  ],\n  \"extensionsUsed\": [\n    \"KHR_materials_unlit\"\n  ]\n}";

  var pickObject = {
    content: content,
    primitive: tileset,
  };

  content._rtcCenterTransform = Matrix4.IDENTITY;
  var rtcCenter = featureTable.getGlobalProperty(
    "RTC_CENTER",
    ComponentDatatype.FLOAT,
    3
  );
  if (defined(rtcCenter)) {
    content._rtcCenterTransform = Matrix4.fromTranslation(
      Cartesian3.fromArray(rtcCenter)
    );
  }

  content._contentModelMatrix = Matrix4.multiply(
    tile.computedTransform,
    content._rtcCenterTransform,
    new Matrix4()
  );

  if (!defined(tileset.classificationType)) {
    // PERFORMANCE_IDEA: patch the shader on demand, e.g., the first time show/color changes.
    // The pick shader still needs to be patched.
    content._model = new Model({
      gltf: gltfView,
      cull: false, // The model is already culled by 3D Tiles
      releaseGltfJson: true, // Models are unique and will not benefit from caching so save memory
      opaquePass: Pass.CESIUM_3D_TILE, // Draw opaque portions of the model during the 3D Tiles pass
      basePath: resource,
      requestType: RequestType.TILES3D,
      modelMatrix: content._contentModelMatrix,
      upAxis: tileset._gltfUpAxis,
      forwardAxis: Axis.X,
      shadows: tileset.shadows,
      debugWireframe: tileset.debugWireframe,
      incrementallyLoadTextures: false,
      vertexShaderLoaded: getVertexShaderCallback(content),
      fragmentShaderLoaded: getFragmentShaderCallback(content),
      uniformMapLoaded: batchTable.getUniformMapCallback(),
      pickIdLoaded: getPickIdCallback(content),
      addBatchIdToGeneratedShaders: batchLength > 0, // If the batch table has values in it, generated shaders will need a batchId attribute
      pickObject: pickObject,
      imageBasedLightingFactor: tileset.imageBasedLightingFactor,
      lightColor: tileset.lightColor,
      luminanceAtZenith: tileset.luminanceAtZenith,
      sphericalHarmonicCoefficients: tileset.sphericalHarmonicCoefficients,
      specularEnvironmentMaps: tileset.specularEnvironmentMaps,
      backFaceCulling: tileset.backFaceCulling,
    });
    content._model.readyPromise.then(function (model) {
      model.activeAnimations.addAll({
        loop: ModelAnimationLoop.REPEAT,
      });
    });
  } else {
    // This transcodes glTF to an internal representation for geometry so we can take advantage of the re-batching of vector data.
    // For a list of limitations on the input glTF, see the documentation for classificationType of Cesium3DTileset.
    content._model = new ClassificationModel({
      gltf: gltfView,
      cull: false, // The model is already culled by 3D Tiles
      basePath: resource,
      requestType: RequestType.TILES3D,
      modelMatrix: content._contentModelMatrix,
      upAxis: tileset._gltfUpAxis,
      forwardAxis: Axis.X,
      debugWireframe: tileset.debugWireframe,
      vertexShaderLoaded: getVertexShaderCallback(content),
      classificationShaderLoaded: getClassificationFragmentShaderCallback(
        content
      ),
      uniformMapLoaded: batchTable.getUniformMapCallback(),
      pickIdLoaded: getPickIdCallback(content),
      classificationType: tileset._classificationType,
      batchTable: batchTable,
    });
  }
}
// jadd end

// jadd 
function oglParserFunction(buffer, geometryId, extend){
  var reader = new ArrayBufferReader(buffer);
  var geometry = new THREE.BufferGeometry();
  reader.getUint32();
  geometry.setAttribute('position', new THREE.BufferAttribute(reader.getFloat32Array(reader.getUint32()), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(reader.getFloat32Array(reader.getUint32()), 3));
  var uvCount = reader.getUint32();
  uvCount && geometry.setAttribute('uv', new THREE.BufferAttribute(reader.getFloat32Array(uvCount), 2));
  var useInt16 = reader.getUint32() == 0, indexArray, indexLength = reader.getUint32();
  if (useInt16) {
      indexArray = reader.getUint16Array(indexLength);
  }
  else {
      indexArray = reader.getUint32Array(indexLength);
  }
  geometry.setIndex(new THREE.BufferAttribute(indexArray, 1));
  //补齐
  if (indexLength % 2 && useInt16) {
      reader.offset += 2;
  }
  if (extend) //set the extend from param
      geometry.boundingBox = new THREE.Box3(extend.minimum, extend.maximum);
  var groupCount = reader.getUint32(); //at least one sub mesh
  // console.log("groupCount:" + groupCount);
  for (var i = 0; i < groupCount; i++) {
      var startIndex = reader.getUint32();
      var indexCount = reader.getUint32();
      var materialIndex = reader.getUint32();
      geometry.addGroup(startIndex, indexCount, materialIndex);
  }
  return geometry;
}
class ArrayBufferReader {
  constructor(buffer) {
    this.buffer = buffer;
    this.int32Array = new Uint32Array(buffer);
    this.offset = 0;

    this.getUint32 = function () {
      var ret = this.int32Array[this.offset / 4]; //this is the trick for fetching the correct uint32 value
      this.offset += 4;
      return ret;
    };
    this.getUint16Array = function (len) {
      var ret = new Uint16Array(this.buffer, this.offset, len);
      this.offset += Uint16Array.BYTES_PER_ELEMENT * len;
      return ret;
    };
    this.getUint32Array = function (len) {
      var ret = new Uint32Array(this.buffer, this.offset, len);
      this.offset += Uint32Array.BYTES_PER_ELEMENT * len;
      return ret;
    };
    this.getFloat32Array = function (len) {
      var ret = new Float32Array(this.buffer, this.offset, len);
      this.offset += Float32Array.BYTES_PER_ELEMENT * len;
      return ret;
    };
  }
}
// jadd end

function createFeatures(content) {
  var featuresLength = content.featuresLength;
  if (!defined(content._features) && featuresLength > 0) {
    var features = new Array(featuresLength);
    for (var i = 0; i < featuresLength; ++i) {
      features[i] = new Cesium3DTileFeature(content, i);
    }
    content._features = features;
  }
}

Batched3DModel3DTileContent.prototype.hasProperty = function (batchId, name) {
  return this._batchTable.hasProperty(batchId, name);
};

Batched3DModel3DTileContent.prototype.getFeature = function (batchId) {
  //>>includeStart('debug', pragmas.debug);
  var featuresLength = this.featuresLength;
  if (!defined(batchId) || batchId < 0 || batchId >= featuresLength) {
    throw new DeveloperError(
      "batchId is required and between zero and featuresLength - 1 (" +
        (featuresLength - 1) +
        ")."
    );
  }
  //>>includeEnd('debug');

  createFeatures(this);
  return this._features[batchId];
};

Batched3DModel3DTileContent.prototype.applyDebugSettings = function (
  enabled,
  color
) {
  color = enabled ? color : Color.WHITE;
  if (this.featuresLength === 0) {
    this._model.color = color;
  } else {
    this._batchTable.setAllColor(color);
  }
};

Batched3DModel3DTileContent.prototype.applyStyle = function (style) {
  if (this.featuresLength === 0) {
    var hasColorStyle = defined(style) && defined(style.color);
    var hasShowStyle = defined(style) && defined(style.show);
    this._model.color = hasColorStyle
      ? style.color.evaluateColor(undefined, this._model.color)
      : Color.clone(Color.WHITE, this._model.color);
    this._model.show = hasShowStyle ? style.show.evaluate(undefined) : true;
  } else {
    this._batchTable.applyStyle(style);
  }
};

Batched3DModel3DTileContent.prototype.update = function (tileset, frameState) {
  var commandStart = frameState.commandList.length;

  // In the PROCESSING state we may be calling update() to move forward
  // the content's resource loading.  In the READY state, it will
  // actually generate commands.
  this._batchTable.update(tileset, frameState);

  this._contentModelMatrix = Matrix4.multiply(
    this._tile.computedTransform,
    this._rtcCenterTransform,
    this._contentModelMatrix
  );
  this._model.modelMatrix = this._contentModelMatrix;

  this._model.shadows = this._tileset.shadows;
  this._model.imageBasedLightingFactor = this._tileset.imageBasedLightingFactor;
  this._model.lightColor = this._tileset.lightColor;
  this._model.luminanceAtZenith = this._tileset.luminanceAtZenith;
  this._model.sphericalHarmonicCoefficients = this._tileset.sphericalHarmonicCoefficients;
  this._model.specularEnvironmentMaps = this._tileset.specularEnvironmentMaps;
  this._model.backFaceCulling = this._tileset.backFaceCulling;
  this._model.debugWireframe = this._tileset.debugWireframe;

  // Update clipping planes
  var tilesetClippingPlanes = this._tileset.clippingPlanes;
  this._model.referenceMatrix = this._tileset.clippingPlanesOriginMatrix;
  if (defined(tilesetClippingPlanes) && this._tile.clippingPlanesDirty) {
    // Dereference the clipping planes from the model if they are irrelevant.
    // Link/Dereference directly to avoid ownership checks.
    // This will also trigger synchronous shader regeneration to remove or add the clipping plane and color blending code.
    this._model._clippingPlanes =
      tilesetClippingPlanes.enabled && this._tile._isClipped
        ? tilesetClippingPlanes
        : undefined;
  }

  // If the model references a different ClippingPlaneCollection due to the tileset's collection being replaced with a
  // ClippingPlaneCollection that gives this tile the same clipping status, update the model to use the new ClippingPlaneCollection.
  if (
    defined(tilesetClippingPlanes) &&
    defined(this._model._clippingPlanes) &&
    this._model._clippingPlanes !== tilesetClippingPlanes
  ) {
    this._model._clippingPlanes = tilesetClippingPlanes;
  }

  this._model.update(frameState);

  // If any commands were pushed, add derived commands
  var commandEnd = frameState.commandList.length;
  if (
    commandStart < commandEnd &&
    (frameState.passes.render || frameState.passes.pick) &&
    !defined(tileset.classificationType)
  ) {
    this._batchTable.addDerivedCommands(frameState, commandStart);
  }
};

Batched3DModel3DTileContent.prototype.isDestroyed = function () {
  return false;
};

Batched3DModel3DTileContent.prototype.destroy = function () {
  this._model = this._model && this._model.destroy();
  this._batchTable = this._batchTable && this._batchTable.destroy();
  return destroyObject(this);
};
export default Batched3DModel3DTileContent;
