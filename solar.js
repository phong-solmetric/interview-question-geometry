// The global map object

'use strict';
var solar = (function() { //Javascript module pattern
    
    var _googleMap; // global variable within the solar module scope
    var _polygons = []; //global array of polygon objects that will be attached to google maps
    
    // This intializes the map and draws a default roof section
    function init() {
        // Load map at default location
        _googleMap = new google.maps.Map(document.getElementById('map'), {
            center: { lat: 38.41795399867498, lng: -122.71177126263503 },
            mapTypeId: google.maps.MapTypeId.SATELLITE,
            draggableCursor: 'crosshair',
            zoom: 20,
            disableDefaultUI: true
        });

        // force orthorgraphic imagery
        _googleMap.setTilt(0);

        // wait until the map projection is fully updated before drawing the roof section
        google.maps.event.addListenerOnce(_googleMap, "projection_changed", createSite);

        //Hook up the 
        var pupulateButton = $("#popupulate-button");
        pupulateButton.click(function() {
            createSite();
        });
    }

    //Here is the function for creating a roof with modules
    function createSite() {
        cleanUpOldSite(); //We need to make sure any old polgyons are removed first
        
        // draw default roof rectangle
        var roofPolygon = createRoofPolygon();
        _polygons.push(roofPolygon);

        // Create modules
        var modules = createModules(roofPolygon);
        for(var i = 0; i < modules.length; i++) {
            _polygons.push(modules[i]);
        }

        render();
    }

    // Create the default roof section rectangle
    function createRoofPolygon() {
        // Roof section rectangle definition.  The definition contains:
        //  roofCenter:  the latitude / longitude location of the center of the rectangle
        //  roofWidth:   width of roof rectangel in meters
        //  roofHeight:  height of roof rectangel in meters
        //  rotation:    rotation angle of rectangle
        var roofPolygonOptions = {
            center:  new google.maps.LatLng(38.41793702224591, -122.71176248788834),
            width: 40.46,  // in meters
            length: 28.35, // in meters
            rotation: 20,      // degrees
            color: '#FF0000', // red
            googleMap: _googleMap
        };

        // Create a google polygon object to overlay on the aerial
        return new Polygon(roofPolygonOptions);
    }

    // Create a list of pv module rectangles to be later attached to our map
    function createModules(roofPolygon) {
        var modulePolygons = [];

        var moduleWidth = Number($("#module-width").val());
        var moduleLength = Number($("#module-length").val());
        var moduleSpacing = Number($("#module-spacing").val());
        
        //PROVIDE AN ALGORITHM FOR DRAWING MODULES ON THE ROOF

        return modulePolygons;
    }

    // Redraws each polygon in our polygon list
    function render() {
        for(var i = 0; i < _polygons.length; i++) {
            var polygon = _polygons[i];
            polygon.removeFromMap();
            polygon.attachToMap();
        }
    }

    //Removes all polygons from map and clears out the polygon list
    function cleanUpOldSite() {
        for(var i = 0; i < _polygons.length; i++) {
            var polygon = _polygons[i];
            polygon.removeFromMap();
        }       
        _polygons = [];
    }   
    
    var Polygon = (function() { //This is the class definition for Polygon
        //Width and length are in distance units,
        //Center is a google maps point in lat,lng coordinates
        //Rotation is in degress
        function Polygon(options) { //This is the constructor for the Polygon class
            // if(typeof width !== "number" || typeof length !== "number" || typeof center !== "object" typeof rotation !== "number")
                // throw new Error("Invalid arguments for constructing a polygon object");
            var _self = this;
            _self.width = options.width;
            _self.length = options.length;
            _self.center = options.center;
            _self.rotation = options.rotation;
            _self.googleMap = options.googleMap;
            _self.color = typeof options.color === "string" ? options.color : "#FF0000";
            _self.path = [];

            createPolygon();
            // In JavaScript member functions declared inside the contruction are private
            function createPolygon() {
                // Create rectangle coordinates, in latitude/longitude space to define roof section rectangle
                var path = [
                    Polygon.offsetLatLngPointByMeters(_self.center, _self.length / 2, -1*_self.width / 2),
                    Polygon.offsetLatLngPointByMeters(_self.center, -1*_self.length / 2, -1*_self.width / 2),
                    Polygon.offsetLatLngPointByMeters(_self.center, -1*_self.length / 2, 1*_self.width / 2),
                    Polygon.offsetLatLngPointByMeters(_self.center, _self.length / 2, _self.width / 2)
                ];

                // Rotate the coordinates by the angle relative to the center of it
                _self.path = rotatePath(path, _self.rotation, _self.center);

                _self.googleMapsPolygon = new google.maps.Polygon({
                    paths: _self.path,
                    strokeColor:  _self.color,
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                    fillColor: _self.color,
                    fillOpacity: 0.35
                });
            }

            // Rotates an input array of latitude/longitude locations by the specified
            // angle around the specified latitude/longitude center
            function rotatePath(path, angle, origin) {
                var prj = _self.googleMap.getProjection();

                var originPt = prj.fromLatLngToPoint(origin);

                var rotatedCoords = path.map(function (latLng) {
                    var point = prj.fromLatLngToPoint(latLng);

                    var rotatedLatLng = prj.fromPointToLatLng(rotatePoint(point, originPt, angle));
                    return rotatedLatLng;
                });
                return rotatedCoords;
            };

            // Rotation transformation
            function rotatePoint(point, origin, angle) {
                var angleRad = angle * Math.PI / 180.0;
                return {
                    x: Math.cos(angleRad) * (point.x - origin.x) - Math.sin(angleRad) * (point.y - origin.y) + origin.x,
                    y: Math.sin(angleRad) * (point.x - origin.x) + Math.cos(angleRad) * (point.y - origin.y) + origin.y
                };
            }
        }

        //These member functions are public because they are attached to the prototype object for the class definition

        //Attaches this polygon to google maps
        Polygon.prototype.attachToMap = function() { //public member function
            this.googleMapsPolygon.setMap(this.googleMap);
        };

        //Removes this polygon from google maps
        Polygon.prototype.removeFromMap = function() { //public member function
            this.googleMapsPolygon.setMap(null);
        };

        // Given a latitude/longitude location, and a distance north and a distance east,
        // return a new latitude/longitude location offset by the distances.
        Polygon.offsetLatLngPointByMeters = function(pointLatLng, deltaNorthMeters, deltaEastMeters) { //Public static member function
            //Earth’s radius, sphere
            var R = 6378137;

            //Coordinate offsets in radians
            var dLat = deltaNorthMeters / R;
            var dLon = deltaEastMeters / (R * Math.cos(Math.PI * pointLatLng.lat() / 180));

            return new google.maps.LatLng(
                pointLatLng.lat() + dLat * 180 / Math.PI,
                pointLatLng.lng() + dLon * 180 /Math.PI);
        };
        
        return Polygon
    })();

    return {
        init: init //Exposes the init function for the solar modular to be used outside
    }
})();
