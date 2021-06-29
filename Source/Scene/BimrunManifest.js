import Cartesian2 from "../Core/Cartesian2.js";
import Cartesian3 from "../Core/Cartesian3.js";
import defaultValue from "../Core/defaultValue.js";
import Check from "../Core/Check.js";
import defined from "../Core/defined.js";
import when from "../ThirdParty/when.js";
import Resource from "../Core/Resource.js";
import Cesium3DTileset from "./Cesium3DTileset.js";

function BimrunManifest(options){
    console.log('manifest');
    options = defaultValue(options, defaultValue.EMPTY_OBJECT);

    Check.defined("options.url", options.url);

    this._url = undefined;
    this._readyPromise = when.defer();
    this._addedTileset = options.addedTileset;
    
    // var that = this;
    // var resource;
    // when(options.url)
    //   .then(function(url){
    //       var basePath;
    //       resource = Resource.creatIfNeeded(url);
    //       that._resource = resource;
    //       console.log(that._resource);
    //       console.log('when-then');

    //       if (resource.extension === "json") {
    //           basePath = resource.getBaseUri(true);
    //       } else if (resource.isDataUri) {
    //           basePath = "";
    //       }

    //       that._url = resource.url;
    //       that._basePath = basePath;

    //       return true;
    //   })

    fetch(options.url)
      .then(res => res.json())
      .then(function(json){
          console.log(json);
          var brjson = {
              asset: {
                generatetool: "@yujiezhang125",
                gltfUpAxis: "Z",
                version: "1.0"
              },
              geometricError: 128,
              root: {
                  boundingVolume: {
                    "box": [
                        0,
                        0,
                        0,
                        512,
                        0,
                        0,
                        0,
                        512,
                        0,
                        0,
                        0,
                        32
                      ]
                  },
                  geometricError: 128,
                  transform: [
                    0.968635634,
                    0.248485428,
                    0,
                    0,
                    -0.159864611,
                    0.623177624,
                    0.765567081,
                    0,
                    0.190232264,
                    -0.741555555,
                    0.643356079,
                    0,
                    1215018.019158861,
                    -4736333.073199854,
                    4081622.5918742213,
                    1
                  ]
              ,
                  refine: "ADD",
                  children: []
              }
          }
        //   console.log(brjson);
        //   for (let i = 0; i < 5; i++){
        //       brjson.root.children[i] = {
        //           transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
        //           boundingVolume: {
        //               box: [0, 0, 0, json.sceneModels[i].extents.x, 
        //               0, 0, 0, json.sceneModels[i].extents.y, 
        //               0, 0, 0, json.sceneModels[i].extents.z]
        //           },
        //           geometrixError: 128,
        //           content: {
        //               url: `http://bimrun.com/bim/resource/` + getOglPath(json, json.sceneModels[i].geometryId),
        //           },
        //           materialInfo: {}
        //       }
        //   }
        //   console.log(brjson);
      })
      .then(function(brjson){
        var brTileset = new Cesium3DTileset({
            brTileset: true,
            url: options.url,
            tilesetJson: brjson,
        });
      })
      
}
Object.defineProperties(BimrunManifest.prototype, {
    name: {
        get: function (){
            return this._name;
        },
        set: function (value){
            this._name = valus;
        },
    },

    url: {
        get: function(){
            return this._url;
        }
    },

    resource: {
        get: function(){
            return this._resource;
        },
    },

    basePath: {
        get: function(){
            return this._basePath;
        }
    },
});

BimrunManifest.prototype.printName = function(){
    console.log(this._name);
};

function getOglPath(manifestJson, geometryId){
    for (let i = 0; i < manifestJson.geometries.length; i++){
        if (manifestJson.geometries[i].id == geometryId){
            return manifestJson.geometries[i].oglPath;
        }
    };
};

export default BimrunManifest;