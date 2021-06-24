import Cartesian2 from "../Core/Cartesian2.js";
import Cartesian3 from "../Core/Cartesian3.js";

function BimrunManifest(options){
    console.log('manifest')
}
Object.defineProperties(BimrunManifest.prototype, {
    name: {
        get: function () {
          return this._name;
        },
        set: function (value) {
            this._name = value;
        },
      },
});

BimrunManifest.prototype.printName = function(){
    console.log(this.name);
};
export default BimrunManifest;