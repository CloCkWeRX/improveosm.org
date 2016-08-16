iD.TelenavLayer = function (context) {

    // automated deploy constants - BEGIN
    var PRODUCTION_API_PATHS = false;
    var TEST_API_SERVER_OW_SERVER = 'http://fcd-ss.skobbler.net:2680/directionOfFlowService_test';
    var TEST_API_SERVER_MR_SERVER = 'http://fcd-ss.skobbler.net:2680/missingGeoService_test';
    var TEST_API_SERVER_TR_SERVER = 'http://fcd-ss.skobbler.net:2680/turnRestrictionService_test';

    var PRODUCTION_API_OW_SERVER = 'http://directionofflow.skobbler.net/directionOfFlowService';
    var PRODUCTION_API_MR_SERVER = 'http://missingroads.skobbler.net/missingGeoService';
    var PRODUCTION_API_TR_SERVER = 'http://turnrestrictionservice.skobbler.net/turnRestrictionService';

    var API_OW_SERVER, API_MR_SERVER, API_TR_SERVER;
    if (PRODUCTION_API_PATHS) {
        API_OW_SERVER = PRODUCTION_API_OW_SERVER;
        API_MR_SERVER = PRODUCTION_API_MR_SERVER;
        API_TR_SERVER = PRODUCTION_API_TR_SERVER;
    } else {
        API_OW_SERVER = TEST_API_SERVER_OW_SERVER;
        API_MR_SERVER = TEST_API_SERVER_MR_SERVER;
        API_TR_SERVER = TEST_API_SERVER_TR_SERVER;
    }
    // automated deploy constants - END

    var CLUSTER_RADIUSES = [
        [45,70,90,110],
        [40,65,85,105],
        [40,60,80,100],
        [35,55,80,95],
        [35,50,75,90],
        [30,45,70,85],
        [30,40,65,80],
        [25,35,60,75],
        [25,35,55,70],
        [25,35,50,65],
        [20,30,45,6],
        [20,30,40,55],
        [20,30,40,50],
        [20,30,40,50],
        [20,30,40,50]
    ];

    var enable = true, //shows the telenav layer by default
        svg,
        requestQueue = [],

        visibleItems = null,

        heatMap = null,
        requestCount;

    var types = {
        dof: API_OW_SERVER + '/search',
        mr: API_MR_SERVER + '/search',
        tr: API_TR_SERVER + '/search'
    };

    var selectedTypes = ['dof', 'mr', 'tr'];

    var dofDetails = ['C1', 'C2', 'C3'];
    var mrDetails = ['ROAD', 'PARKING', 'BOTH', 'WATER', 'PATH'];
    var trDetails = ['C1', 'C2'];

    var dofSelectedDetails = ['C1'];
    var mrSelectedDetails = ['ROAD'];
    var trSelectedDetails = ['C1'];


    // === IMPROVE OSM HEADER logging in part === begin
    context.connection().userDetails(function(err, user) {
        if (!err) {
            d3.select('#telenavHeaderLogin').classed('hidden', true);
            d3.select('#telenavHeaderLogout').classed('hidden', false);
            d3.select('#telenavHeaderLogout span').text('Hello ' + user.display_name + '!')
        }
    });
    d3.select('#telenavHeaderLogin').on('click', function() {
        context.connection().authenticate(function(err) {
            if (err) {
                alert('Authentication Error');
            } else {
                d3.select('#telenavHeaderLogin').classed('hidden', true);
                d3.select('#telenavHeaderLogout').classed('hidden', false);
                context.connection().userDetails(function(err, user) {
                    if (!err) {
                        d3.select('#telenavHeaderLogout span').text('Hello ' + user.display_name + '!')
                    }
                });
            }
        });
    });
    d3.select('#telenavHeaderLogout .logout-btn').on('click', function() {
        context.connection().logout();
        d3.select('#telenavHeaderLogin').classed('hidden', false);
        d3.select('#telenavHeaderLogout').classed('hidden', true);
    });
    // === IMPROVE OSM HEADER logging in part === end

    d3.select('.subscribe').on('click', function(){
        $('#subscriptionPanel').dialog({
            modal: true
        });

        $('#mc-embedded-subscribe').click(function(){
            $('#subscriptionPanel').dialog('close');
        })
    })

    var Utils = {};
    Utils.getTileSquare = function(x, y) {
        var n = Math.pow(2, 18);// HARD CODING the 18
        var longitudeMin = x/n * 360 - 180;
        var lat_rad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y/n)));
        var latitudeMin = lat_rad * 180/Math.PI;

        var longitudeMax = (x + 1)/n * 360 -180;
        lat_rad = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1)/n)));
        var latitudeMax = lat_rad * 180/Math.PI;
        return {
            latMax: latitudeMin,
            latMin: latitudeMax,
            lonMin: longitudeMin,
            lonMax: longitudeMax
        }
    };
    Utils.orderSegments = function(segments, entry) {
        var newSegments = [];
        var rawSegments = segments.slice(0);
        var currentAnchor = entry;
        while (rawSegments.length > 0) {
            for (var i = 0; i < rawSegments.length; i++) {
                var item = rawSegments[i][0];
                if (currentAnchor.lat == item.lat && currentAnchor.lon == item.lon) {
                    break;
                }
            }
            var segment = rawSegments[i];
            if (typeof segment == 'undefined') {
                break;
            }
            currentAnchor = rawSegments[i][segment.length - 1];
            newSegments.push(rawSegments[i]);
            rawSegments.splice(i, 1);
        }
        return newSegments;
    };
    Utils.getDistance = function(p1, p2) {

        var x1 = Math.floor(context.projection([p1.lon, p1.lat])[0]);
        var y1 = Math.floor(context.projection([p1.lon, p1.lat])[1]);

        var x2 = Math.floor(context.projection([p2.lon, p2.lat])[0]);
        var y2 = Math.floor(context.projection([p2.lon, p2.lat])[1]);

        var a = x1 - x2;
        var b = y1 - y2;

        return Math.sqrt(a * a + b * b);
    };
    Utils.findMiddle = function(p1, p2, d, dif) {
        var x1 = Math.floor(context.projection([p1.lon, p1.lat])[0]);
        var y1 = Math.floor(context.projection([p1.lon, p1.lat])[1]);

        var x2 = Math.floor(context.projection([p2.lon, p2.lat])[0]);
        var y2 = Math.floor(context.projection([p2.lon, p2.lat])[1]);

        var a = x2 - x1;
        var b = y2 - y1;

        dif = d - dif;

        var newX = (a * dif) / d;
        var newY = (b * dif) / d;

        newX = newX + x1;
        newY = newY + y1;

        return '' + newX + ',' + newY;
    };
    Utils.getSegmentAngle = function(p1, p2) {
        return Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
    };
    Utils.splitSegment = function(segment) {
        var length = 0;
        var distances = [];
        for (var i = 0; i < segment.length - 1; i++) {
            var d = Utils.getDistance(segment[i], segment[i + 1]);
            length += d;
            distances.push(d);
        }
        var target = length / 2;
        length = 0;
        var location = 0;
        for (var i = 0; i < segment.length - 1; i++) {
            length += distances[i];
            if (length > target) {
                location = i;
                break;
            }
        }

        var newPoint = Utils.findMiddle(
            segment[location],
            segment[location + 1],
            distances[location],
            length - target
        );

        return {
            newPoint: newPoint,
            index: location
        };
    };

    // ==============================
    // ==============================
    // VisibleItems
    // ==============================
    // ==============================
    var VisibleItems = function() {

        this.rawItems = [];
        this.items = [];

        this.normalItems = [];
        this.clusteredItems = [];
        this.selectedItems = [];

        this.selectedClusteredItems = [];
        this.totalSelectedItems = [];

        this.loadOneWays = function(rawData) {
            for (var i = 0; i < rawData.length; i++) {
                var item = rawData[i];
                this.rawItems.push(item);
                this.items.push(new DirectionOfFlowItem(item));
            }
        };

        this.loadMissingRoads = function(rawData) {
            for (var i = 0; i < rawData.length; i++) {
                var item = rawData[i];
                this.rawItems.push(item);
                this.items.push(new MissingRoadItem(item));
            }
        };

        this.loadTurnRestrictions = function(rawData) {
            for (var i = 0; i < rawData.length; i++) {
                var item = rawData[i];
                this.rawItems.push(item);
                this.items.push(new TurnRestrictionItem(item));
            }
        };

        this.deselectAll = function() {
            // totalSelectedItems is emptied
            // current selection items are moved to the normal items OR to the cluster items
            this.totalSelectedItems.length = 0;
            for (var i = 0; i < this.selectedItems.length; i++) {
                this.normalItems.push(this.selectedItems[i]);
            }
            this.selectedItems.length = 0;
            render(d3.select('.layer-telenav'));
        };
        this.unselectItem = function(itemId) {
            // item must be removed from both total and current selection arrays
            // item must be added to the normal items, OR to the cluster items, if inside a cluster
            var neededItem = null;
            var item = null;
            for (var i = 0; i < this.totalSelectedItems.length; i++) {
                if (this.totalSelectedItems[i].id === itemId) {
                    item = this.totalSelectedItems[i];
                    this.totalSelectedItems.splice(i, 1);
                }
            }
            for (var i = 0; i < this.selectedItems.length; i++) {
                if (this.selectedItems[i].id === itemId) {
                    item = this.selectedItems[i];
                    this.selectedItems.splice(i, 1);
                }
            }
            // insert item in normal or cluster arrays
            if (this.isItemPartOfClusters(item)) {
                this.addItemToClusters(item);
            }
            render(d3.select('.layer-telenav'));
        };
        this.selectItem = function(item) {
            // item must be added to both total and current selection arrays
            // item must be removed from the normal items, OR from the cluster items, if inside a cluster
            this.totalSelectedItems.push(item);
            this.selectedItems.push(item);
            // remove item from normal or cluster arrays
            for (var i = 0; i < this.normalItems.length; i++) {
                if (this.normalItems[i].id === item.id) {
                    this.normalItems.splice(i , 1);
                }
            }
            for (var i = 0; i < this.clusteredItems.length; i++) {
                var checkedItem = this.clusteredItems[i];
                // compare for equality
                if (
                    (checkedItem.lat === item.point.lat) &&
                    (checkedItem.lon === item.point.lon)
                ) {
                    for (var j = 0; j < checkedItem.items.length; j++) {
                        if (checkedItem.items[j].id === item.id) {
                            checkedItem.items.splice(j , 1);
                        }
                    }
                }
            }
            render(d3.select('.layer-telenav'));
        };

        this.isItemSelected = function(item) {
            for (var i = 0; i < this.totalSelectedItems.length; i++) {
                var checkedItem = this.totalSelectedItems[i];
                if (checkedItem.id === item.id) {
                    return true;
                }
            }
            return false;
        };

        this.isItemPartOfClusters = function(item) {
            if (item.className === 'TurnRestrictionItem') {
                var key = item.point.lat + ',' + item.point.lon;
                for (var i = 0; i < this.clusteredItems.length; i++) {
                    var checkedItem = this.clusteredItems[i];
                    // compare for equality
                    if (
                        (checkedItem.point.lat === item.point.lat) &&
                        (checkedItem.point.lon === item.point.lon)
                    ) {
                        return true;
                    }
                }
                return false;
            } else {
                return false;
            }
        };

        this.addItemToClusters = function(item) {
            if (item.className === 'TurnRestrictionItem') {
                for (var i = 0; i < this.clusteredItems.length; i++) {
                    var checkedItem = this.clusteredItems[i];
                    // compare for equality
                    if (
                        (checkedItem.lat === item.point.lat) &&
                        (checkedItem.lon === item.point.lon)
                    ) {
                        checkedItem.items.push(item);
                    }
                }
                throw new Error('VisibleItems::addItemToClusters - not a clustered item');
            } else {
                throw new Error('VisibleItems::addItemToClusters - not a clustered item');
            }
        };


        this.getClusterSiblings = function(item) {
            if (item.className !== 'TurnRestrictionItem') {
                return null;
            }
            for (var i = 0; i < this.clusteredItems.length; i++) {
                var checkedItem = this.clusteredItems[i];
                var id = item.point.lat + ',' + item.point.lon;
                if (checkedItem.id === id) {
                    return {
                        siblings: checkedItem.items,
                        selected: item.id
                    };
                }
            }
            for (var i = 0; i < this.selectedClusteredItems.length; i++) {
                var checkedItem = this.selectedClusteredItems[i];
                var id = item.point.lat + ',' + item.point.lon;
                if (checkedItem.id === id) {
                    return {
                        siblings: checkedItem.items,
                        selected: item.id
                    };
                }
            }
            return null;
        };

        this.getTotalSelectionItem = function(i) {
            if (i >= this.totalSelectedItems.length) {
                throw new Error('SelectedItems : getItem - problem');
            }
            return this.totalSelectedItems[i];
        };

        this.selectionHasCluster = function() {
            if (this.selectedClusteredItems.length > 0) {
                return true;
            } else {
                return false;
            }
        };

        this.update = function() {

            // ===
            // we need to check what items were selected before and add them to the selected group
            // ===
            this.normalItems.length = 0;
            this.selectedItems.length = 0;
            // for each new item, find out if it's already in the TOTAL selected item list
            for (var i = 0; i < this.items.length; i++) {
                var found = false;
                for (var j = 0; j < this.totalSelectedItems.length; j++) {
                    // if we find a new item that should be selected, we add it to the CURRENT selected items
                    if (this.items[i].id === this.totalSelectedItems[j].id) {
                        this.selectedItems.push(this.items[i]);
                        found = true;
                        break;
                    }
                }
                // else we add it to the normalItems
                if (!found) {
                    this.normalItems.push(this.items[i]);
                }
            }

            var nodeMap = {};
            // for all items
            for (var i = 0; i < this.normalItems.length; i++) {
                var item = this.normalItems[i];
                if (item.className === 'TurnRestrictionItem') {
                    // build a comparison key
                    var key = item.point.lat + ',' + item.point.lon;
                    // if the key is a fresh one, not searched before
                    if (!nodeMap.hasOwnProperty(key)) {
                        var siblingsFound = [];
                        // search other instances of the fresh key
                        for (var j = i + 1; j < this.normalItems.length; j++) {
                            var checkedItem = this.normalItems[j];
                            if (checkedItem.className === 'TurnRestrictionItem') {
                                // compare for equality
                                if (
                                    (checkedItem.point.lat === item.point.lat) &&
                                    (checkedItem.point.lon === item.point.lon)
                                ) {
                                    siblingsFound.push(checkedItem);
                                }
                            }
                        }
                        // mark new found siblings
                        if (siblingsFound.length > 0) {
                            if (typeof nodeMap[key] === 'undefined') {
                                nodeMap[key] = siblingsFound;
                            }
                            nodeMap[key].push(item);
                        }
                    }
                }
            }

            // ===
            // for every selected items, if there is a corresponding cluster, move it to selectedClusters and remove it
            // ===
            this.selectedClusteredItems.length = 0;
            for (var i = 0; i < this.selectedItems.length; i++) {
                var item = this.selectedItems[i];
                if (item.className === 'TurnRestrictionItem') {
                    var key = item.point.lat + ',' + item.point.lon;
                    if (nodeMap.hasOwnProperty(key)) {
                        nodeMap[key].unshift(item);
                        this.selectedClusteredItems.push(new ClusteredItem({
                            lat: item.point.lat,
                            lon: item.point.lon,
                            items: nodeMap[key]
                        }));
                        delete nodeMap[key];
                    }
                }
            }

            this.clusteredItems.length = 0;
            // iterating the map and building the cluster elements
            for (var key in nodeMap) {
                if (nodeMap.hasOwnProperty(key)) {
                    var coordinates = key.split(',');
                    this.clusteredItems.push(new ClusteredItem({
                        lat: parseFloat(coordinates[0]),
                        lon: parseFloat(coordinates[1]),
                        items: nodeMap[key]
                    }));
                }
            }

            // we finally need to remove the cluster items from the normal items
            var normalItems = [];
            for (var i = 0; i < this.normalItems.length; i++) {
                var item = this.normalItems[i];
                if (item.className === 'TurnRestrictionItem') {
                    // build a comparation key
                    var key = item.point.lat + ',' + item.point.lon;
                    // if the key does not exists (the item is not part of a cluster), we keep it
                    if (!nodeMap.hasOwnProperty(key)) {
                        normalItems.push(item);
                    }
                } else {
                    normalItems.push(item);
                }
            }
            this.normalItems = normalItems;
        };

    };
    var visibleItems = new VisibleItems();

    // ==============================
    // ==============================
    // MapItem
    // ==============================
    // ==============================
    var MapItem = function() {
        // ---
        this.className = 'MapItem';
        this.id = null;

        this.selected = false;

        this.isA = function(proposedClassName) {
            return proposedClassName === this.className;
        };

        this.transformId = function() {
            return this.id;
        };
        this.transformClass = function() {
            if(this.className != 'MissingRoadItem') {
                return 'item ' /*+ (this.selected ? 'selected ' : '')*/ + this.className;
            } else {
                return 'item ' /*+ (this.selected ? 'selected ' : '')*/ + this.className + ' ' + this.status.toLowerCase() + ' ' + this.type.toLowerCase();
            }
        };
            //// ================
            //// HANDLE SELECTION
            //// ================
        this.handleSelection = function() {
            if (visibleItems.isItemSelected(this)) {
                if (d3.event.ctrlKey) {
                    visibleItems.unselectItem(this.id);
                } else {
                    if (visibleItems.totalSelectedItems.length === 1) {
                        visibleItems.deselectAll();
                    } else {
                        visibleItems.deselectAll();
                        visibleItems.selectItem(this);
                        _editPanel.showSiblings(visibleItems.getClusterSiblings(this));
                    }
                }
            } else {
                if (d3.event.ctrlKey) {
                    visibleItems.selectItem(this);
                    _editPanel.showSiblings(visibleItems.getClusterSiblings(this));
                } else {
                    visibleItems.deselectAll();
                    visibleItems.selectItem(this);
                    _editPanel.showSiblings(visibleItems.getClusterSiblings(this));
                }
            }
            d3.event.stopPropagation();
            if (visibleItems.totalSelectedItems.length === 0) {
                _editPanel.goToMain();
            } else {
                _editPanel.goToEdit(this);
                _editPanel.selectedItemDetails(this);
            }
        };
    };

    // ==============================
    // ==============================
    // ClusteredItemView
    // ==============================
    // ==============================
    var ClusteredItemView = function(rawItemData) {
        // ---
        this.className = 'ClusteredItemView';
        this.id = 'tr_' + rawItemData.id.replace(/\:/g,'_').replace(/\+/g,'_').replace(/\#/g,'_');
        this.point = rawItemData.point;
        this.spotId = [rawItemData.point.lat, rawItemData.point.lon].join(',');
    };

    // ==============================
    // ==============================
    // TurnRestrictionItem
    // ==============================
    // ==============================
    var TurnRestrictionItem = function(rawItemData) {
        // ---
        this.className = 'TurnRestrictionItem';
        this.id = 'tr_' + rawItemData.id.replace(/\:/g,'_').replace(/\+/g,'_').replace(/\#/g,'_');
        this.point = rawItemData.point;
        this.confidenceLevel = rawItemData.confidenceLevel;
        this.numberOfPasses = rawItemData.numberOfPasses;
        this.turnType = rawItemData.turnType;
        this.status = rawItemData.status;
        this.segments = rawItemData.segments;
        this.spotId = [rawItemData.point.lat, rawItemData.point.lon].join(',');

        this.getPoint = function() {
            return rawItemData.point;
        };
        this.getIdentifier = function() {
            return [
                rawItemData.id
            ];
        };
        this.getInNo = function() {
            var x = rawItemData.segments[0].points[0].lon;
            var y = rawItemData.segments[0].points[0].lat;
            var toX = rawItemData.segments[0].points[1].lon;
            var toY = rawItemData.segments[0].points[1].lat;
            return {
                val: rawItemData.segments[0].numberOfTrips,
                p: {
                    x: Math.floor(context.projection([x, y])[0]),
                    y: Math.floor(context.projection([x, y])[1])
                },
                toP: {
                    x: Math.floor(context.projection([toX, toY])[0]),
                    y: Math.floor(context.projection([toX, toY])[1])
                }
            }
        };
        this.getOutNo = function() {
            // preparing segments for them to be ordered
            var rawSegments = [];
            for (var i = 1; i < rawItemData.segments.length; i++) {
                var rawPoints = [];
                for (var j = 0; j < rawItemData.segments[i].points.length; j++) {
                    rawPoints.push(rawItemData.segments[i].points[j]);
                }
                rawSegments.push(rawPoints);
            }
            // order them
            var segments = Utils.orderSegments(rawSegments, this.point);
            // pick our last two points
            var lastSegment = segments.length - 1;
            var lastPoint = segments[lastSegment].length - 1;
            var x = segments[lastSegment][lastPoint].lon;
            var y = segments[lastSegment][lastPoint].lat;
            var toX = segments[lastSegment][lastPoint - 1].lon;
            var toY = segments[lastSegment][lastPoint - 1].lat;
            return {
                val: rawItemData.numberOfPasses,
                p: {
                    x: Math.floor(context.projection([x, y])[0]),
                    y: Math.floor(context.projection([x, y])[1])
                },
                toP: {
                    x: Math.floor(context.projection([toX, toY])[0]),
                    y: Math.floor(context.projection([toX, toY])[1])
                }
            }
        };
        this.highlight = function(highlight) {
            svg.selectAll('g.highlightedItemLayer *').remove();
            if (highlight) {
                var This = this;
                var gElement = svg.selectAll('g.highlightedItemLayer').append('g').attr('class', 'trItem');
                var circle = gElement.append('circle');
                circle.attr('cx', this.transformX());
                circle.attr('cy', this.transformY());
                circle.attr('r', '20');
                gElement.on('click', function() {
                    This.handleSelection();
                });
            }
        };
        this.transformX = function() {
            return Math.floor(context.projection([this.point.lon, this.point.lat])[0]);
        };
        this.transformY = function() {
            return Math.floor(context.projection([this.point.lon, this.point.lat])[1]);
        };
        this.transformLinePointsOut = function() {
            var rawSegments = [];
            for (var i = 1; i < this.segments.length; i++) {
                var rawPoints = [];
                for (var j = 0; j < this.segments[i].points.length; j++) {
                    rawPoints.push(this.segments[i].points[j]);
                }
                rawSegments.push(rawPoints);
            }

            var segments = Utils.orderSegments(rawSegments, this.point);

            var stringPoints = [];
            for (var i = 0; i < segments.length; i++) {
                for (var j = 0; j < segments[i].length; j++) {
                    var point = context.projection([segments[i][j].lon, segments[i][j].lat]);
                    stringPoints.push(point.toString());
                }
            }

            return stringPoints.join(' ');
        };
        this.transformLinePointsIn1 = function() {
            var stringPoints = [];
            var split = Utils.splitSegment(this.segments[0].points);
            for (var j = 0; j < this.segments[0].points.length; j++) {
                var point = context.projection([this.segments[0].points[j].lon, this.segments[0].points[j].lat]);
                stringPoints.push(point.toString());
            }
            stringPoints.splice(split.index + 1, 0, split.newPoint);
            stringPoints.splice(split.index + 2, stringPoints.length - (split.index + 1));
            return stringPoints.join(' ');
        };
        this.transformLinePointsIn2 = function() {
            var stringPoints = [];
            var split = Utils.splitSegment(this.segments[0].points);
            for (var j = 0; j < this.segments[0].points.length; j++) {
                var point = context.projection([this.segments[0].points[j].lon, this.segments[0].points[j].lat]);
                stringPoints.push(point.toString());
            }
            stringPoints.splice(split.index + 1, 0, split.newPoint);
            stringPoints.splice(0, split.index + 1);
            return stringPoints.join(' ');
        };
        this.transformInNoX = function() {
            var inNo = this.getInNo();
            var angle = Utils.getSegmentAngle(inNo.p, inNo.toP);
            return inNo.p.x + this.getLabelOffset(angle, false, true).x;
        };
        this.transformInNoY = function() {
            var inNo = this.getInNo();
            var angle = Utils.getSegmentAngle(inNo.p, inNo.toP);
            return inNo.p.y + this.getLabelOffset(angle, false, true).y;
        };
        this.transformInNo = function() {
            return this.getInNo().val;
        };
        this.transformOutNoX = function() {
            var outNo = this.getOutNo();
            var angle = Utils.getSegmentAngle(outNo.p, outNo.toP);
            return outNo.p.x + this.getLabelOffset(angle, true, true).x;
        };
        this.transformOutNoY = function() {
            var outNo = this.getOutNo();
            var angle = Utils.getSegmentAngle(outNo.p, outNo.toP);
            return outNo.p.y + this.getLabelOffset(angle, true, true).y;
        };
        this.transformOutNo = function() {
            return this.getOutNo().val;
        };
        this.transformInNoRectX = function() {
            var inNo = this.getInNo();
            var angle = Utils.getSegmentAngle(inNo.p, inNo.toP);
            return inNo.p.x + this.getLabelOffset(angle, false, false).x;
        };
        this.transformInNoRectY = function() {
            var inNo = this.getInNo();
            var angle = Utils.getSegmentAngle(inNo.p, inNo.toP);
            return inNo.p.y + this.getLabelOffset(angle, false, false).y;
        };
        this.transformOutNoRectX = function() {
            var outNo = this.getOutNo();
            var angle = Utils.getSegmentAngle(outNo.p, outNo.toP);
            return outNo.p.x + this.getLabelOffset(angle, true, false).x;
        };
        this.transformOutNoRectY = function() {
            var outNo = this.getOutNo();
            var angle = Utils.getSegmentAngle(outNo.p, outNo.toP);
            return outNo.p.y + this.getLabelOffset(angle, true, false).y;
        };
        this.transformInNoRectWidth = function() {
            return (this.getInNo().val.toString().length * 6) + 6;
        };
        this.transformOutNoRectWidth = function() {
            return (this.getOutNo().val.toString().length * 6) + 6;
        };
        this.getLabelOffset = function(angle, arrowPresent, isText) {
            var defaultXoffset = -13;
            var defaultYoffset = -8;
            if (isText) {
                defaultXoffset = -10;
                defaultYoffset = 3;
            }
            var mainOffset = 20;
            if (arrowPresent) {
                mainOffset = 35;
            }
            if (angle < 0) {
                angle = 360 + angle;
            }
            if (angle == 0) {
                angle = 360;
            }
            if (angle < 0 || angle > 360) {
                throw new Error('TurnRestrictionItem : getLabelOffset - problem');
            } else if (angle > 0 && angle <= 180) {
                // segment direction DOWN
                // label direction UP
                return {
                    x: defaultXoffset,
                    y: defaultYoffset - mainOffset
                };
            } else if (angle > 180 && angle <= 360) {
                // segment direction UP
                // label direction DOWN
                return {
                    x: defaultXoffset,
                    y: defaultYoffset + mainOffset
                };
            }
        };
    };
    // static
    TurnRestrictionItem.prototype = new MapItem();

    // ==============================
    // ==============================
    // MissingRoadIcon
    // ==============================
    // ==============================
    var MissingRoadItem = function(rawItemData) {
        this.className = 'MissingRoadItem';
        this.id = ('mr_' + rawItemData.x + '_' + rawItemData.y).replace(/\./g,'_');
        this._points = rawItemData.points;
        this.numberOfTrips = rawItemData.numberOfTrips;
        this.type = rawItemData.type;
        this.status = rawItemData.status;
        this.timestamp = rawItemData.timestamp * 1000; // JS needs miliseconds
        this.spotId = [rawItemData.x, rawItemData.y].join(',');
        this.x = rawItemData.x;
        this.y = rawItemData.y;

        this.getX = function() {
            return rawItemData.x;
        };
        this.getY = function() {
            return rawItemData.y;
        };
        this.getIdentifier = function() {
            return [{
                x: rawItemData.x,
                y: rawItemData.y
            }];
        };
        this.highlight = function(highlight) {
            svg.selectAll('g.highlightedItemLayer *').remove();
            if (highlight) {
                var This = this;
                var gElement = svg.selectAll('g.highlightedItemLayer').append('g').attr('class', 'mrItem');
                var rect = gElement.append('rect');
                rect.attr('x', this.computeTileX());
                rect.attr('y', this.computeTileY());
                rect.attr('width', this.computeTileWidth());
                rect.attr('height', this.computeTileHeight());
                gElement.on('click', function() {
                    This.handleSelection();
                });
            }
        };
        this.computeTileX = function() {
            var squareCoords = Utils.getTileSquare(this.x, this.y);
            var startLat = squareCoords.latMax;
            var startLon = squareCoords.lonMin;
            return Math.floor(context.projection([startLon, startLat])[0]);
        };
        this.computeTileY = function() {
            var squareCoords = Utils.getTileSquare(this.x, this.y);
            var startLat = squareCoords.latMax;
            var startLon = squareCoords.lonMin;
            return Math.floor(context.projection([startLon, startLat])[1]);
        };
        this.computeTileWidth = function() {
            var squareCoords = Utils.getTileSquare(this.x, this.y);
            var startLat = squareCoords.latMax;
            var startLon = squareCoords.lonMin;
            var startX = Math.floor(context.projection([startLon, startLat])[0]);
            var endLat = squareCoords.latMin;
            var endLon = squareCoords.lonMax;
            var endX = Math.floor(context.projection([endLon, endLat])[0]);
            return Math.abs(endX - startX);
        };
        this.computeTileHeight = function() {
            var squareCoords = Utils.getTileSquare(this.x, this.y);
            var startLat = squareCoords.latMax;
            var startLon = squareCoords.lonMin;
            var startY = Math.floor(context.projection([startLon, startLat])[1]);
            var endLat = squareCoords.latMin;
            var endLon = squareCoords.lonMax;
            var endY = Math.floor(context.projection([endLon, endLat])[1]);
            return Math.abs(endY - startY);
        };
        this.computeX = function(i) {
            return Math.floor(context.projection([this._points[i].lon, this._points[i].lat])[0]);
        };
        this.computeY = function(i) {
            return Math.floor(context.projection([this._points[i].lon, this._points[i].lat])[1]);
        };
    };
    MissingRoadItem.prototype = new MapItem();

    // ==============================
    // ==============================
    // DirectionOfFlowItem
    // ==============================
    // ==============================
    var DirectionOfFlowItem = function(rawItemData) {
        this.className = 'DirectionOfFlowItem';
        this.id = 'dof_' + [rawItemData.fromNodeId, rawItemData.toNodeId, rawItemData.wayId].join('_');
        this.confidence = rawItemData.confidenceLevel;
        this.numberOfTrips = rawItemData.numberOfTrips;
        this.roadType = rawItemData.type;
        this.status = rawItemData.status;
        this.percentageOfTrips = rawItemData.percentOfTrips;
        this.spotId = [rawItemData.fromNodeId, rawItemData.toNodeId, rawItemData.wayId].join(',');

        this.getPoints = function() {
            return rawItemData.points;
        };
        this.getIdentifier = function() {
            return [{
                wayId: rawItemData.wayId,
                fromNodeId: rawItemData.fromNodeId,
                toNodeId: rawItemData.toNodeId
            }];
        };
        this.highlight = function(highlight) {
            svg.selectAll('g.highlightedItemLayer *').remove();
            if (highlight) {
                var This = this;
                var gElement = svg.selectAll('g.highlightedItemLayer').append('g').attr('class', 'owItem');
                var line = gElement.append('polyline');
                line.style('marker-end', 'url(#telenav-arrow-black)');
                line.attr('points', this.transformLinePoints());
                gElement.on('click', function() {
                    This.handleSelection();
                });
            }
        };
        this.transformLinePoints = function() {
            var stringPoints = [];
            for (var i = 0; i < this.getPoints().length; i++) {
                var point = context.projection([this.getPoints()[i].lon, this.getPoints()[i].lat]);
                stringPoints.push(point.toString());
            }
            return stringPoints.join(' ');
        };

    };
    DirectionOfFlowItem.prototype = new MapItem();

    // ==============================
    // ==============================
    // ClusteredItem
    // ==============================
    // ==============================
    var ClusteredItem = function(rawData) {
        this.id = rawData.lat + ',' + rawData.lon;
        this.class = 'ClusteredItem';
        this.items = rawData.items;

        this.transformClass = function() {
            return 'item ' + this.class;
        };
        this.transformId = function() {
            return this.id;
        };

        this.transformX = function(offset) {
            if (typeof offset === 'undefined') {
                offset = 0;
            }
            return Math.floor(context.projection([rawData.lon, rawData.lat])[0]) + offset;
        };
        this.transformY = function(offset) {
            if (typeof offset === 'undefined') {
                offset = 0;
            }
            return Math.floor(context.projection([rawData.lon, rawData.lat])[1]) + offset;
        };
        this.transformAmount = function() {
            return this.items.length;
        };
        this.highlight = function(highlight) {
            svg.selectAll('g.highlightedItemLayer *').remove();
            if (highlight) {
                var This = this;
                var gElement = svg.selectAll('g.highlightedItemLayer').append('g').attr('class', 'clItem');
                var circle = gElement.append('circle');
                circle.attr('cx', this.transformX());
                circle.attr('cy', this.transformY());
                circle.attr('r', '25');
                gElement.on('click', function() {
                    This.handleSelection();
                });
            }
        };
        this.handleSelection = function() {
            if (visibleItems.selectionHasCluster()) {
                visibleItems.deselectAll();
            }
            this.items[0].handleSelection();
        }
    };

    // ==============================
    // ==============================
    // ClusterCircle
    // ==============================
    // ==============================
    var ClusterCircle = function(rawItemData, type) {
        this.className = 'ClusterCircle';
        this.id = 'cc_' + [rawItemData.point.lat, rawItemData.point.lon, rawItemData.size].join('_');
        this.point = rawItemData.point;
        this.size = rawItemData.size;
        this.type = type;
        this.pixelRadius = null;

        this.transformId = function() {
            return this.id;
        };
        this.transformClass = function() {
            return this.className;
        };
        this.transformType = function() {
            return this.type;
        };
        this.transformX = function() {
            return Math.floor(context.projection([this.point.lon, this.point.lat])[0]);
        };
        this.transformY = function() {
            return Math.floor(context.projection([this.point.lon, this.point.lat])[1]);
        };
        this.transformR = function() {
            return this.pixelRadius;
        };
    };

    // ==============================
    // ==============================
    // HeatMap
    // ==============================
    // ==============================
    var HeatMap = function(zoom) {

        this.radiuses = CLUSTER_RADIUSES[zoom];
        this.maxCircleSize = 1;
        this.clusters = [];

        this.loadClusters = function(rawData, type) {
            for (var i = 0; i < rawData.length; i++) {
                if (this.maxCircleSize < rawData[i].size) {
                    this.maxCircleSize = rawData[i].size;
                }
                this.clusters.push(new ClusterCircle(
                    rawData[i], type
                ));
            }
        };

        this.categorizeClusters = function() {
            for (var i = 0; i < this.clusters.length; i++) {
                var cluster = this.clusters[i];
                var fraction = this.maxCircleSize / 4;
                if (cluster.size < fraction) {
                    cluster.pixelRadius = this.radiuses[0] / 2;
                } else if (cluster.size < fraction * 2) {
                    cluster.pixelRadius = this.radiuses[1] / 2;
                } else if (cluster.size < fraction * 3) {
                    cluster.pixelRadius = this.radiuses[2] / 2;
                } else {
                    cluster.pixelRadius = this.radiuses[3] / 2;
                }
            }
        };

    };

    // ==============================
    // ==============================
    // EditPanel
    // ==============================
    // ==============================
    var EditPanel = function() {

        this._location = 'MAIN';
        this.editMode = true;

        this.status = 'OPEN';

        //get the width of the panel for animation effect
        this._panelWidth = function(){
            return parseInt(d3.select('.telenav-wrap').style('width'));
        }

        this.getLocation = function() {
            return this._location;
        };

        this.toggleEditMode = function(editMode) {

            var roadMr = d3.select('#telenav_roadMr');
            var parkingMr = d3.select('#telenav_parkingMr');
            var bothMr = d3.select('#telenav_bothMr');
            var waterMr = d3.select('#telenav_waterMr');
            var pathMr = d3.select('#telenav_pathMr');

            if (typeof editMode !== 'boolean') {
                throw new Error('EditMode::toggleEditMode - unexpected parameter');
            } else if (editMode) {
                roadMr.classed('editMode', true);
                parkingMr.classed('editMode', true);
                bothMr.classed('editMode', true);
                waterMr.classed('editMode', true);
                pathMr.classed('editMode', true);

                d3.select('#telenav-active').classed('selected', true)
                d3.select('#telenav-inactive').classed('selected', false)
                d3.select('.layer-telenav').classed('editMode', true);
                this.editMode = true;
            } else {
                roadMr.classed('editMode', false);
                parkingMr.classed('editMode', false);
                bothMr.classed('editMode', false);
                waterMr.classed('editMode', false);
                pathMr.classed('editMode', false);

                d3.select('#telenav-active').classed('selected', false)
                d3.select('#telenav-inactive').classed('selected', true)
                d3.select('.layer-telenav').classed('editMode', false);
                this.editMode = false;
            }
        };

        this.deselectAll = function() {
            visibleItems.deselectAll();
            this.goToMain();
        };

        this.enableActivationSwitch = function(enable) {
            var activeButton = d3.select('#telenav-active');
            var inactiveButton = d3.select('#telenav-inactive');
            var owDot = d3.select('#telenav-oneWay-headerDot');
            var mrwDot = d3.select('#telenav-missingRoad-headerDot');
            var trDot = d3.select('#telenav-turnRestriction-headerDot');

            var roadMr = d3.select('#telenav_roadMr');
            var parkingMr = d3.select('#telenav_parkingMr');
            var bothMr = d3.select('#telenav_bothMr');
            var waterMr = d3.select('#telenav_waterMr');
            var pathMr = d3.select('#telenav_pathMr');

            if (_editPanel.editMode) {
                roadMr.classed('editMode', true);
                parkingMr.classed('editMode', true);
                bothMr.classed('editMode', true);
                waterMr.classed('editMode', true);
                pathMr.classed('editMode', true);
            } else {
                roadMr.classed('editMode', false);
                parkingMr.classed('editMode', false);
                bothMr.classed('editMode', false);
                waterMr.classed('editMode', false);
                pathMr.classed('editMode', false);
            }

            if (enable) {
                inactiveButton.style('opacity', '1');
                activeButton.style('opacity', '1');
                inactiveButton.on('click', _editPanel.onActivationSwitchClick);
                activeButton.on('click', _editPanel.onActivationSwitchClick);
                owDot.style('visibility', 'hidden');
                mrwDot.style('visibility', 'hidden');
                trDot.style('visibility', 'hidden');

                roadMr.classed('showShade', true);
                parkingMr.classed('showShade', true);
                bothMr.classed('showShade', true);
                waterMr.classed('showShade', true);
                pathMr.classed('showShade', true);
            } else {
                inactiveButton.style('opacity', '0.2');
                activeButton.style('opacity', '0.2');
                inactiveButton.on('click', null);
                activeButton.on('click', null);
                owDot.style('visibility', 'visible');
                mrwDot.style('visibility', 'visible');
                trDot.style('visibility', 'visible');

                roadMr.classed('showShade', false);
                parkingMr.classed('showShade', false);
                bothMr.classed('showShade', false);
                waterMr.classed('showShade', false);
                pathMr.classed('showShade', false);
            }
        };

        this.onActivationSwitchClick = function() {
            if(!_editPanel.editMode){
                _editPanel.toggleEditMode(true);
            } else {
                _editPanel.toggleEditMode(false);
            }
        }

        this.showSiblings = function(siblings) {
            if (siblings === null) {
                d3.select('#siblingsPanel').classed('hide', true);
                return;
            }
            var selected = siblings.selected,
                selectedConfidenceLvl;
            siblings = siblings.siblings;
            if (siblings.length > 1) {
                d3.select('#siblingsPanel').classed('hide', false);
                var listElement = d3.select('#siblingsList');
                listElement.html('');
                // a sort is needed so that the item list keeps the same
                siblings.sort(function(a, b) {
                    if (a.id > b.id) return -1;
                    if (a.id < b.id) return 1;
                    return 0;
                });
                for (var i = 0; i < siblings.length; i++) {
                    var element = listElement.append('li').attr('data-id', siblings[i].id);
                    if (selected == siblings[i].id) {
                        element.classed('selected', true);
                    }
                    var span1 = element.append('span');
                    span1.append('i');
                    var span2 = element.append('span');
                    span2.attr('class', 'trListHeader').text(siblings[i].turnType.replace(/_/g, " ").toLowerCase());
                    switch (siblings[i].confidenceLevel) {
                        case 'C1':
                            selectedConfidenceLvl = 'Highly Probable';
                            break;
                        case 'C2':
                            selectedConfidenceLvl = 'Probable';
                            break;
                    }
                    var span3 = element.append('span');
                    span3
                        .text(selectedConfidenceLvl);
                    var span4 = element.append('span');
                    span4
                        .text(siblings[i].numberOfPasses);

                    element.on('click', function() {
                        var item = null;
                        for (var i = 0; i < visibleItems.items.length; i++) {
                            if (visibleItems.items[i].id === d3.event.currentTarget.attributes[0].nodeValue) {
                                item = visibleItems.items[i];
                            }
                        }
                        item.handleSelection();
                    });
                }
            } else {
                d3.select('#siblingsPanel').classed('hide', true);
            }
        };

        this.goToMain = function() {
            d3.select('.telenavwrap')
                .transition()
                .style('transform', 'translate3d(0px, 0px,  0px)');
            this._location = 'MAIN';
        };

        this.goToEdit = function(item) {
            switch (this.getLocation()) {
                case 'MAIN':
                    d3.select('.telenavwrap')
                        .transition()
                        .style('transform', 'translate3d(' + this._panelWidth() + 'px, 0px,  0px)');
                    break;
                case 'EDIT':
                    break;
                case 'MORE':
                    d3.select('.telenavwrap')
                        .transition()
                        .style('transform', 'translate3d(' + this._panelWidth() + 'px, 0px,  0px)');
                    break;
            }
            this._location = 'EDIT';
        };

        this.goToMore = function() {
            switch (this.getLocation()) {
                case 'MAIN':
                    d3.select('.telenavwrap')
                        .transition()
                        .style('transform', 'translate3d(-' + this._panelWidth() + 'px, 0px,  0px)');
                    break;
                case 'EDIT':
                    d3.select('.telenavwrap')
                        .transition()
                        .style('transform', 'translate3d(-' + 2 * this._panelWidth() + 'px, 0px,  0px)');
                    break;
                case 'MORE':
                    break;
            }
            this._location = 'MORE';
        };

        this.selectedItemDetails = function selectedItemDetails(item){
            var confidenceLvl;
            d3.selectAll('#statusSetter div').classed('selected', false);
            d3.select('#statusSetter div[data-filter-type=' + this.status + ']').classed('selected', true);
            switch (item.className){
                case 'TurnRestrictionItem':
                    switch (item.confidenceLevel) {
                        case 'C1':
                            confidenceLvl = 'Highly Probable';
                            break;
                        case 'C2':
                            confidenceLvl = 'Probable';
                            break;
                    }
                    d3.select('.itemDetails').html("");
                    d3.select('#commentText').value('');
                    var TRdetailsContainer = d3.select('.itemDetails').append('table');
                    var TRdetailsRow_incoming = TRdetailsContainer.append('tr');
                    TRdetailsRow_incoming.append('th')
                        .attr('colspan', '3')
                        .text(item.segments[0].numberOfTrips + ' trips entered the first segment');
                    var TRdetailsRow_outgoing = TRdetailsContainer.append('tr');
                    TRdetailsRow_outgoing.append('th')
                        .attr('colspan', '3')
                        .text(item.numberOfPasses + ' trip(s) continued on the last segment');
                    var TRdetailsRow_status = TRdetailsContainer.append('tr');
                    TRdetailsRow_status.append('th')
                        .text('Status');
                    TRdetailsRow_status.append('td')
                        .text(item.status.toLowerCase());
                    var TRdetailsRow_turnType = TRdetailsContainer.append('tr');
                    TRdetailsRow_turnType.append('th')
                        .text('Road Type');
                    TRdetailsRow_turnType.append('td')
                        .text(item.turnType.replace(/_/g, " ").toLowerCase());
                    var TRdetailsRow_confidence = TRdetailsContainer.append('tr');
                    TRdetailsRow_confidence.append('th')
                        .text('Confidence');
                    TRdetailsRow_confidence.append('td')
                        .text(confidenceLvl.toLowerCase() + ' turn restriction');

                    break;
                case 'MissingRoadItem':
                    var dateStamp = new Date(item.timestamp),
                        timestamp = dateStamp.getFullYear() + '-' + (dateStamp.getMonth() + 1) +  '-' + dateStamp.getDate() + ' ' + (dateStamp.getHours() + 1) + ':' + (dateStamp.getMinutes() + 1) + ':' + (dateStamp.getSeconds() + 1);
                    d3.select('.itemDetails').html("");
                    d3.select('#commentText').value('');
                    var MRdetailsContainer = d3.select('.itemDetails').append('table');
                    var MRdetailsRow_type = MRdetailsContainer.append('tr');
                    MRdetailsRow_type.append('th')
                        .text('Type');
                    MRdetailsRow_type.append('td')
                        .text('probable ' + item.type.toLowerCase());
                    var MRdetailsRow_status = MRdetailsContainer.append('tr');
                    MRdetailsRow_status.append('th')
                        .text('Status');
                    MRdetailsRow_status.append('td')
                        .text(item.status.toLowerCase());
                    var MRdetailsRow_timestamp = MRdetailsContainer.append('tr');
                    MRdetailsRow_timestamp.append('th')
                        .text('Timestamp');
                    MRdetailsRow_timestamp.append('td')
                        .text(timestamp);
                    var MRdetailsRow_nbOfTrips = MRdetailsContainer.append('tr');
                    MRdetailsRow_nbOfTrips.append('th')
                        .text('Trip count');
                    MRdetailsRow_nbOfTrips.append('td')
                        .text(item.numberOfTrips);
                    var MRdetailsRow_nbOfPoints = MRdetailsContainer.append('tr');
                    MRdetailsRow_nbOfPoints.append('th')
                        .text('Points count');
                    MRdetailsRow_nbOfPoints.append('td')
                        .text(item._points.length);

                    break;
                case 'DirectionOfFlowItem':
                    d3.select('.itemDetails').html("");
                    switch (item.confidence) {
                        case 'C1':
                            confidenceLvl = 'Highly Probable';
                            break;
                        case 'C2':
                            confidenceLvl = 'Most Likely';
                            break;
                        case 'C3':
                            confidenceLvl = 'Probable';
                            break;
                    }
                    d3.select('.itemDetails').html("");
                    d3.select('#commentText').value('');
                    var DoFdetailsContainer = d3.select('.itemDetails').append('table');
                    var DoFdetailsRow_percetageOfTrips = DoFdetailsContainer.append('tr');
                    DoFdetailsRow_percetageOfTrips.append('th')
                        .attr('colspan', '3')
                        .text(item.percentageOfTrips + '% of drivers travelled in this direction' );
                    var DoFdetailsRow_totalTrips = DoFdetailsContainer.append('tr');
                    DoFdetailsRow_totalTrips.append('th')
                        .text('Total Trips');
                    DoFdetailsRow_totalTrips.append('td')
                        .text(item.numberOfTrips);
                    var DoFdetailsRow_type = DoFdetailsContainer.append('tr');
                    DoFdetailsRow_type.append('th')
                        .text('Road Type');
                    DoFdetailsRow_type.append('td')
                        .text(item.roadType.replace(/_/g, " ").toLowerCase());
                    var DoFdetailsRow_status = DoFdetailsContainer.append('tr');
                    DoFdetailsRow_status.append('th')
                        .text('Status');
                    DoFdetailsRow_status.append('td')
                        .text(item.status.toLowerCase());
                    var DoFdetailsRow_confidence = DoFdetailsContainer.append('tr');
                    DoFdetailsRow_confidence.append('th')
                        .text('Confidence');
                    DoFdetailsRow_confidence.append('td')
                        .text(confidenceLvl.toLowerCase() + ' oneway');

                    break;
            }
        };

        this.setStatus = function(status) {

            d3.selectAll('#statusSetter div').classed('selected', false);
            d3.select('#statusSetter div[data-filter-type=' + status + ']').classed('selected', true);

            var This = this;

            context.connection().userDetails(function(err, user) {
                if (err) {
                    context.connection().authenticate(function(err) {
                        if (err) {
                            alert('Authentication Error');
                        } else {
                            This.setStatus(status);
                        }
                    });
                    return;
                }

                status = status.toUpperCase();
                for (var i = 0; i < visibleItems.totalSelectedItems.length; i++) {
                    var currentItem = visibleItems.getTotalSelectionItem(i);

                    var dataToPost = {
                        username: user.display_name,
                        text: 'status changed',
                        status: status
                    };

                    var responseHandler = function(err, rawData) {
                        var data = JSON.parse(rawData.response);
                        console.log("got response", data);
                    };

                    switch (currentItem.className) {
                        case 'DirectionOfFlowItem':
                            dataToPost.roadSegments = currentItem.getIdentifier();
                            d3.xhr(API_OW_SERVER + '/comment')
                                .header("Content-Type", "application/json")
                                .post(
                                    JSON.stringify(dataToPost),
                                    responseHandler
                                );
                            break;
                        case 'MissingRoadItem':
                            dataToPost.tiles = currentItem.getIdentifier();
                            d3.xhr(API_MR_SERVER + '/comment')
                                .header("Content-Type", "application/json")
                                .post(
                                    JSON.stringify(dataToPost),
                                    responseHandler
                                );
                            break;
                        case 'TurnRestrictionItem':
                            dataToPost.targetIds = currentItem.getIdentifier();
                            d3.xhr(API_TR_SERVER + '/comment')
                                .header("Content-Type", "application/json")
                                .post(
                                    JSON.stringify(dataToPost),
                                    responseHandler
                                );
                            break;
                    }

                }
            });

        };

        this.saveComment = function() {

            var This = this;

            context.connection().userDetails(function(err, user) {
                if (err) {
                    context.connection().authenticate(function(err) {
                        if (err) {
                            alert('Authentication Error');
                        } else {
                            This.saveComment();
                        }
                    });
                    return;
                }
                var comment = d3.select('#commentText').property('value');

                for (var i = 0; i < visibleItems.totalSelectedItems.length; i++) {
                    var currentItem = visibleItems.getTotalSelectionItem(i);

                    var dataToPost = {
                        username: 'Tudor009',
                        text: comment
                    };

                    var responseHandler = function (err, rawData) {
                        var data = JSON.parse(rawData.response);
                        d3.select('#commentText').value('');
                        console.log("got response", data);
                    };

                    switch (currentItem.className) {
                        case 'DirectionOfFlowItem':
                            dataToPost.roadSegments = currentItem.getIdentifier();
                            d3.xhr(API_OW_SERVER + '/comment')
                                .header("Content-Type", "application/json")
                                .post(
                                    JSON.stringify(dataToPost),
                                    responseHandler
                                );
                            break;
                        case 'MissingRoadItem':
                            dataToPost.tiles = currentItem.getIdentifier();
                            d3.xhr(API_MR_SERVER + '/comment')
                                .header("Content-Type", "application/json")
                                .post(
                                    JSON.stringify(dataToPost),
                                    responseHandler
                                );
                            break;
                        case 'TurnRestrictionItem':
                            dataToPost.targetIds = currentItem.getIdentifier();
                            d3.xhr(API_TR_SERVER + '/comment')
                                .header("Content-Type", "application/json")
                                .post(
                                    JSON.stringify(dataToPost),
                                    responseHandler
                                );
                            break;
                    }

                }
            });
        };

    };

    var _editPanel = new EditPanel();

    var _synchClusterCallbacks = function(error, data, type) {

        if (data.hasOwnProperty('clusters')) {
            heatMap.loadClusters(data.clusters, type);
        }

        if (!--requestCount) {

            if (error) {
                svg.selectAll('g.cluster')
                    .remove();
                return;
            }
            heatMap.categorizeClusters();
            var g = svg.selectAll('g.cluster')
                .data(heatMap.clusters, function(cluster) {
                    return cluster.id;
                });

            var enter = g.enter().append('g')
                .attr('class', function(item) {
                    return item.transformClass();
                })
                .classed('cluster', true)
                .attr('id', function(item) {
                    return item.transformId();
                });

            var circle = enter.append('circle')
                .attr('class', function(item) {
                    return item.transformType();
                })
                .attr('cx', function(item) {
                    return item.transformX();
                })
                .attr('cy', function(item) {
                    return item.transformY();
                })
                .attr('r', function(item) {
                    return item.transformR();
                });

            g.exit()
                .remove();
        }
    };

    var _synchCallbacks = function(error, data) {

        if (error) {
            clearAllLayers();
            return;
        }

        if (data.hasOwnProperty('roadSegments')) {
            visibleItems.loadOneWays(data.roadSegments);
        }
        if (data.hasOwnProperty('tiles')) {
            visibleItems.loadMissingRoads(data.tiles);
        }
        if (data.hasOwnProperty('entities')) {
            visibleItems.loadTurnRestrictions(data.entities);
        }

        if (!--requestCount) {

            visibleItems.update();

            drawItems('normal');
            drawClusteredItems();
            drawItems('selected');
        }

    };

    function drawClusteredItems() {
        var data = svg.select('g.clusteredItemsLayer').selectAll('g.item')
            .data(visibleItems.clusteredItems, function(item) {
                return item.id;
            });


        var clusterElement = data.enter().append('g')
            .attr('class', function(item) {
                return item.transformClass();
            })
            .attr('id', function(item) {
                return item.transformId();
            });

        var circle = clusterElement.append('circle')
            .attr('class', 'main')
            .attr('cx', function(item) {
                return item.transformX();
            })
            .attr('cy', function(item) {
                return item.transformY();
            })
            .attr('r', '25');
        var selCircle = clusterElement.append('circle')
            .attr('class', 'selectable')
            .attr('cx', function(item) {
                return item.transformX();
            })
            .attr('cy', function(item) {
                return item.transformY();
            })
            .attr('r', '25');
        var textElem = clusterElement.append('text')
            .attr('x', function(item) {
                return item.transformX(-5);
            })
            .attr('y', function(item) {
                return item.transformY(7);
            })
            .html(function(item) {
                return item.transformAmount();
            });

        clusterElement.on('mouseover', function(item) {
            item.highlight(true);
        });

        data.exit()
            .remove();
    }

    function drawItems(type) {
        var data = null;
        switch (type) {
            case 'normal':
                data = svg.select('g.normalItemsLayer').selectAll('g.item')
                    .data(visibleItems.normalItems, function(item) {
                        return item.id;
                    });
                break;
            case 'selected':
                data = svg.select('g.selectedItemsLayer').selectAll('g.item')
                    .data(visibleItems.selectedItems, function(item) {
                        return item.id;
                    });
                break;
        }


        var enter = data.enter().append('g')
            .attr('class', function(item) {
                return item.transformClass();
            })
            .attr('id', function(item) {
                return item.transformId();
            });

        var dOFs = enter.filter(function(item) {
            return item.isA('DirectionOfFlowItem');
        });
        var mRs = enter.filter(function(item) {
            return item.isA('MissingRoadItem');
        });
        var tRs = enter.filter(function(item) {
            return item.isA('TurnRestrictionItem');
        });

        var dofPoly = dOFs.append('polyline');
        dofPoly.attr('class', 'main');
        switch (type) {
            case 'normal':
                dofPoly.style('marker-end', 'url(#telenav-arrow-orange)');
                break;
            case 'selected':
                dofPoly.style('marker-end', 'url(#telenav-arrow-purple)');
                break;
        }

        dofPoly.attr('points', function(item) {
            return item.transformLinePoints();
        });
        var owHighlight = dOFs.append('polyline').attr('class', 'selectable');
        owHighlight.attr('points', function(item) {
            return item.transformLinePoints();
        });

        mRs.html(function(d) {
            var html = '';
            html += '<rect x=' + d.computeTileX()
                + ' y=' + d.computeTileY()
                + ' width=' + d.computeTileWidth()
                + ' height=' + d.computeTileHeight()
                + '></rect>';
            for (var i = 0; i < d._points.length; i++) {
                var cx = d.computeX(i);
                var cy = d.computeY(i);
                html += '<circle cx=' + cx + ' cy=' + cy + ' r=3></circle>';
            }
            html += '<rect x=' + d.computeTileX()
                + ' y=' + d.computeTileY()
                + ' width=' + d.computeTileWidth()
                + ' height=' + d.computeTileHeight()
                + ' class="selectable"'
                + '></rect>';
            return html;
        });

        var trPolyIn1 = tRs.append('polyline');
        trPolyIn1.attr('points', function(item) {
            return item.transformLinePointsIn1();
        });
        trPolyIn1.attr('class', 'wayIn1');
        trPolyIn1.style('marker-end', 'url(#telenav-arrow-green)');
        var trPolyIn2 = tRs.append('polyline');
        trPolyIn2.attr('points', function(item) {
            return item.transformLinePointsIn2();
        });
        trPolyIn2.attr('class', 'wayIn2');
        tRs.append('rect').attr('class', 'noInRect')
            .attr('width', function(item) {
                return item.transformInNoRectWidth();
            })
            .attr('height', '16')
            .attr('x', function(item) {
                return item.transformInNoRectX();
            })
            .attr('y', function(item) {
                return item.transformInNoRectY();
            });
        tRs.append('text').attr('class', 'inNo')
            .attr('x', function(item) {
                return item.transformInNoX();
            })
            .attr('y', function(item) {
                return item.transformInNoY()
            })
            .html(function(item) {
                return item.transformInNo();
            });
        tRs.append('rect').attr('class', 'noOutRect')
            .attr('width', function(item) {
                return item.transformOutNoRectWidth();
            })
            .attr('height', '16')
            .attr('x', function(item) {
                return item.transformOutNoRectX();
            })
            .attr('y', function(item) {
                return item.transformOutNoRectY();
            });
        tRs.append('text').attr('class', 'outNo')
            .attr('x', function(item) {
                return item.transformOutNoX();
            })
            .attr('y', function(item) {
                return item.transformOutNoY();
            })
            .html(function(item) {
                return item.transformOutNo();
            });
        var trPolyOut = tRs.append('polyline');
        trPolyOut.attr('points', function(item) {
            return item.transformLinePointsOut();
        });
        trPolyOut.attr('class', 'wayOut');
        trPolyOut.style('marker-end', 'url(#telenav-arrow-red)');
        var trCircle = tRs.append('circle')
            .attr('class', 'telenav-tr-marker')
            .attr('cx', function(item) {
                return item.transformX();
            })
            .attr('cy', function(item) {
                return item.transformY();
            })
            .attr('r', '20');
        var trSelCircle = tRs.append('circle').attr('class', 'selectable')
            .attr('cx', function(item) {
                return item.transformX();
            })
            .attr('cy', function(item) {
                return item.transformY();
            })
            .attr('r', '20');

        dOFs.on('mouseover', function(item) {
            item.highlight(true);
        });
        mRs.on('mouseover', function(item) {
            item.highlight(true);
        });
        tRs.on('mouseover', function(item) {
            item.highlight(true);
        });

        data.exit()
            .remove();
    };

    function render(selection) {

        var zoom = Math.floor(context.map().zoom());

        d3.select("#sidebar").classed('telenavPaneActive', enable);
        d3.select(".pane-telenav").classed('hidden', !enable);

        svg = selection.selectAll('svg')
            .data([0]);

        svg.enter().append('svg');


        svg.selectAll('g.deselectSurface')
            .remove();

        // *****************************
        // HANDLING OF CLICK DESELECTION
        // *****************************
        if (svg.selectAll('g.deselectSurface').empty()) {
            svg
                .insert('g', ':first-child')
                .attr('class', 'deselectSurface')
                .append('rect')
                .attr('width', svg.attr('width'))
                .attr('height', svg.attr('height'));
            svg.selectAll('g.deselectSurface').on('click', function () {
                //if (selectedItems.getSize() > 0) {
                if (visibleItems.totalSelectedItems.length > 0) {
                    //selectedItems.empty();
                    visibleItems.deselectAll();
                    _editPanel.goToMain();
                }
            });
            svg.selectAll('g.deselectSurface').on('mouseover', function () {
                svg.selectAll('g.highlightedItemLayer *').remove();
            });
        }

        // *********************************
        // ADDING LAYERS THE FIRST TIME ONLY
        // *********************************
        if (svg.selectAll('g.normalItemsLayer').empty()) {
            svg
                .append('g')
                .attr('class', 'normalItemsLayer');
        }
        if (svg.selectAll('g.clusteredItemsLayer').empty()) {
            svg
                .append('g')
                .attr('class', 'clusteredItemsLayer');
        }
        if (svg.selectAll('g.selectedItemsLayer').empty()) {
            svg
                .append('g')
                .attr('class', 'selectedItemsLayer');
        }
        if (svg.selectAll('g.highlightedItemLayer').empty()) {
            svg
                .append('g')
                .attr('class', 'highlightedItemLayer');
        }

        svg.style('display', enable ? 'block' : 'none');


        if (!enable) {

            clearAllLayers();
            svg.selectAll('g.cluster')
                .remove();

            return;
        }

        moveClusteredItems();

        var clusterCircles = svg.selectAll('.ClusterCircle > circle');
        clusterCircles.attr('cx', function(item) {
            return item.transformX();
        });
        clusterCircles.attr('cy', function(item) {
            return item.transformY();
        });

        var directionOfFlowPolylines = svg.selectAll('.DirectionOfFlowItem > polyline.main');
        directionOfFlowPolylines.attr('points', function(item) {
            return item.transformLinePoints();
        });
        var owHighlight = svg.selectAll('.DirectionOfFlowItem > polyline.selectable');
        owHighlight.attr('points', function(item) {
            return item.transformLinePoints();
        });

        var missingRoadsCircles = svg.selectAll('.MissingRoadItem');
        missingRoadsCircles.html(function(d) {
            var html = '';
            html += '<rect x=' + d.computeTileX()
                + ' y=' + d.computeTileY()
                + ' width=' + d.computeTileWidth()
                + ' height=' + d.computeTileHeight()
                + '></rect>';
            for (var i = 0; i < d._points.length; i++) {
                var cx = d.computeX(i);
                var cy = d.computeY(i);
                html += '<circle cx=' + cx + ' cy=' + cy + ' r=3></circle>';
            }
            html += '<rect x=' + d.computeTileX()
                + ' y=' + d.computeTileY()
                + ' width=' + d.computeTileWidth()
                + ' height=' + d.computeTileHeight()
                + ' class="selectable"'
                + '></rect>';
            return html;
        });

        var trCircle = svg.selectAll('.TurnRestrictionItem > circle');
        trCircle.attr('cx', function(item) {
            return item.transformX();
        });
        trCircle.attr('cy', function(item) {
            return item.transformY();
        });
        var trSelCircle = svg.selectAll('.TurnRestrictionItem > circle.selectable');
        trSelCircle.attr('cx', function(item) {
            return item.transformX();
        });
        trSelCircle.attr('cy', function(item) {
            return item.transformY();
        });
        var turnRestrictionPolylinesIn1 = svg.selectAll('.TurnRestrictionItem > polyline.wayIn1');
        turnRestrictionPolylinesIn1.attr('points', function(item) {
            return item.transformLinePointsIn1();
        });
        var turnRestrictionPolylinesIn2 = svg.selectAll('.TurnRestrictionItem > polyline.wayIn2');
        turnRestrictionPolylinesIn2.attr('points', function(item) {
            return item.transformLinePointsIn2();
        });
        var turnRestrictionPolylinesOut = svg.selectAll('.TurnRestrictionItem > polyline.wayOut');
        turnRestrictionPolylinesOut.attr('points', function(item) {
            return item.transformLinePointsOut();
        });

        var tRinNo = svg.selectAll('.TurnRestrictionItem > text.inNo');
        tRinNo
            .attr('x', function(item) {
                return item.transformInNoX();
            })
            .attr('y', function(item) {
                return item.transformInNoY()
            })
            .html(function(item) {
                return item.transformInNo();
            });
        var tRinNoInRect = svg.selectAll('.TurnRestrictionItem > rect.noInRect');
        tRinNoInRect
            .attr('x', function(item) {
                return item.transformInNoRectX();
            })
            .attr('y', function(item) {
                return item.transformInNoRectY();
            });
        var tRinNo = svg.selectAll('.TurnRestrictionItem > text.outNo');
        tRinNo
            .attr('x', function(item) {
                return item.transformOutNoX();
            })
            .attr('y', function(item) {
                return item.transformOutNoY();
            })
            .html(function(item) {
                return item.transformOutNo();
            });
        var tRinNoOutRect = svg.selectAll('.TurnRestrictionItem > rect.noOutRect');
        tRinNoOutRect
            .attr('x', function(item) {
                return item.transformOutNoRectX();
            })
            .attr('y', function(item) {
                return item.transformOutNoRectY();
            });

        var extent = context.map().extent();

        if (requestQueue.length > 0) {
            for (var i = 0; i < requestQueue.length; i++) {
                requestQueue[i].abort();
            }
            requestQueue.length = 0;
        }

        var boundingBoxUrlFragments = '?south=' +
            extent[0][1] + '&north=' + extent[1][1] + '&west=' +
            extent[0][0] + '&east=' + extent[1][0] + '&zoom=' + zoom;

        var requestUrlQueue = [];
        var pushedTypes = [];
        for (var i = 0; i < selectedTypes.length; i++) {
            var typesFragments = '';
            switch (selectedTypes[i]) {
                case 'dof':
                    typesFragments += '&confidenceLevel=';
                    typesFragments += dofSelectedDetails.join('%2C');
                    break;
                case 'mr':
                    typesFragments += '&type=';
                    typesFragments += mrSelectedDetails.join('%2C');
                    break;
                case 'tr':
                    typesFragments += '&confidenceLevel=';
                    typesFragments += trSelectedDetails.join('%2C');
                    break;
            }
            requestUrlQueue.push(
                types[selectedTypes[i]] + boundingBoxUrlFragments + typesFragments + '&status=' + _editPanel.status + '&client=WEBAPP&version=1.2'
            );
            pushedTypes.push(selectedTypes[i]);
        }

        requestCount = requestUrlQueue.length;
        visibleItems.items.length = 0;

        if ((zoom > 14) && (requestUrlQueue.length !== 0)) {
            svg.selectAll('g.cluster')
                .remove();
            for (var i = 0; i < requestUrlQueue.length; i++) {
                requestQueue[i] = d3.json(requestUrlQueue[i], _synchCallbacks);
            }
            _editPanel.enableActivationSwitch(true);
        } else if (requestUrlQueue.length !== 0) {
            clearAllLayers();
            heatMap = new HeatMap(zoom);
            _editPanel.enableActivationSwitch(false);
            for (var i = 0; i < requestUrlQueue.length; i++) {
                var type = pushedTypes[i];
                !function (type) {
                    requestQueue[i] = d3.json(requestUrlQueue[i], function (error, data) {
                        _synchClusterCallbacks(error, data, type);
                    });
                }(type);
            }
        } else {
            clearAllLayers();
            svg.selectAll('g.cluster')
                .remove();
        }
    };

    function moveClusteredItems() {
        var clusteredItems = svg.selectAll('.ClusteredItem > circle');
        clusteredItems.attr('cx', function(item) {
            return item.transformX();
        });
        clusteredItems.attr('cy', function(item) {
            return item.transformY();
        });
        var clusteredItems = svg.selectAll('.ClusteredItem > text');
        clusteredItems.attr('x', function(item) {
            return item.transformX(-5);
        });
        clusteredItems.attr('y', function(item) {
            return item.transformY(7);
        });
    }

    function clearAllLayers() {
        svg.select('g.normalItemsLayer').selectAll('g.item')
            .remove();
        svg.select('g.clusteredItemsLayer').selectAll('g.ClusteredItem')
            .remove();
        svg.select('g.normalItemsLayer').selectAll('g.item')
            .remove();
    };

    render.enable = function(_) {
        if (!arguments.length) return enable;
        enable = _;
        return render;
    };

    render.dimensions = function(_) {
        if (!arguments.length) return svg.dimensions();
        svg.dimensions(_);
        return render;
    };

    var buildPane = function() {

        var div = d3.selectAll('.pane_telenav')
            .data([0]);

        var enter = div.enter().append('div')
            .attr('class', 'pane-telenav col4 hidden');
        var telenavWrapPanel = enter.append('div')
            .attr('class', 'telenav-wrap');
        var telenavWrap = telenavWrapPanel.append('div')
            .attr('class', 'telenavwrap');

        //  START 3rd container div
        var userWindow = telenavWrap.append('div')
            .attr('id', 'userWindow')
            .attr('class', 'entity-editor-pane pane');
        var userWindowHeader = userWindow.append('div')
            .attr('class', 'header fillL cf');

        userWindowHeader.append('h3')
            .attr('class', 'main-header')
            .text('Improve OSM panel');
        var backDeselectWrapper = userWindowHeader.append('div')
            .attr('class', 'button-wrap single joined fr')
        backDeselectWrapper.append('button')
            .attr('class', 'telenav-back telenav-header-button')
            .attr('id', 'telenav-back')
            .on('click', function(){
                _editPanel.deselectAll();
                render(d3.select('.layer-telenav'));
            })
            .append('span')
            .text('Back / Deselect');
        var userWindowBody = userWindow.append('div')
            .attr('class', 'telenav-body');
        var userWindowInner = userWindowBody.append('div')
            .attr('class', 'inspector-border inspector-preset')
            .append('div');
        var userContainer = userWindowInner.append('div')
            .attr('class', 'preset-form inspector-inner');
        var multipleTR_form = userContainer.append('div')
            .attr('class', 'form-field')
            .attr('id', 'siblingsPanel');
        multipleTR_form.append('label')
            .attr('class', 'form-label')
            .text('Possible Turn Restrictions:')
            .append('div')
            .attr('class', 'form-label-button-wrap');

        var multipleTR_formWrap = multipleTR_form.append('form')
            .attr('class', 'filterForm optionsContainer trList')
            .append('ul')
            .attr('id', 'siblingsList');

        var detailedInfo_form = userContainer.append('div')
            .attr('class', 'form-field');
        detailedInfo_form.append('label')
            .attr('class', 'form-label')
            .text('Detailed Information')
            .append('div')
            .attr('class', 'form-label-button-wrap');

        detailedInfo_form.append('form')
            .attr('class', 'filterForm optionsContainer itemDetails');

        var statusUpdate_form = userContainer.append('div')
            .attr('class', 'form-field');
        statusUpdate_form.append('label')
            .attr('class', 'form-label')
            .text('Change Status')
            .append('div')
            .attr('class', 'form-label-button-wrap');
        var statusUpdate_formWrap = statusUpdate_form.append('form')
            .attr('class', 'filterForm optionsContainer')
            .attr('id', 'statusSetter');

        var statusSetterOpen = statusUpdate_formWrap.append('div')
            .attr('class', 'tel_displayInline' + (_editPanel.status === 'OPEN' ? ' selected' : ''))
            .attr('data-filter-type', 'OPEN');
        statusSetterOpen.append('span')
            .text('open');

        var statusSetterSolved = statusUpdate_formWrap.append('div')
            .attr('class', 'tel_displayInline' + (_editPanel.status === 'SOLVED' ? ' selected' : ''))
            .attr('data-filter-type', 'SOLVED');
        statusSetterSolved.append('span')
            .text('solved');

        var statusSetterInvalid = statusUpdate_formWrap.append('div')
            .attr('class', 'tel_displayInline' + (_editPanel.status === 'INVALID' ? ' selected' : ''))
            .attr('data-filter-type', 'INVALID');
        statusSetterInvalid.append('span')
            .text('invalid');

        var comments_form = userContainer.append('div')
            .attr('class', 'form-field');
        comments_form.append('label')
            .attr('class', 'form-label')
            .text('Comment')
            .append('div')
            .attr('class', 'form-label-button-wrap')
            .append('button')
            .attr('class', 'save-icon')
            .attr('id', 'saveComment')
            .call(iD.svg.Icon('#icon-save'));
        comments_form.append('textarea')
            .attr('class', 'commentText')
            .attr('maxLength', '600')
            .attr('id', 'commentText');

        //  END 3rd container div

        //  START 1st container div
        var generalSettingsWindow = telenavWrap.append('div')
            .attr('id', 'generalSettingsWindow')
            .attr('class', 'entity-editor-pane pane pane-middle');
        var generalWindowsWindowHeader = generalSettingsWindow.append('div')
            .attr('class', 'header fillL cf');

        generalWindowsWindowHeader.append('h3')
            .attr('class', 'main-header')
            .text('Improve OSM panel');
        var switchWrapper = generalWindowsWindowHeader.append('div')
            .attr('class', 'button-wrap joined fr')
        switchWrapper.append('button')
            .attr('class', 'telenav-header-button active selected')
            .attr('id', 'telenav-active')
            .append('span')
            .text('Active');
        switchWrapper.append('button')
            .attr('class', 'telenav-header-button inactive')
            .attr('id', 'telenav-inactive')
            .append('span')
            .text('Inactive');
        var generalSettingsBody = generalSettingsWindow.append('div')
            .attr('class', 'telenav-body');

        var containerBorder = generalSettingsBody.append('div')
            .attr('class', 'inspector-border inspector-preset')
            .append('div');
        var presetFormContainer = containerBorder.append('div')
            .attr('class', 'preset-form inspector-inner');

        var presetForm = presetFormContainer.append('div')
            .attr('class', 'form-field');
        presetForm.append('label')
            .attr('class', 'form-label')
            .text('Reported Status');
        var statusForm = presetForm.append('form')
            .attr('class', 'filterForm optionsContainer')
            .attr('id', 'statusFilter');
        var statusDivOpen = statusForm.append('div')
            .attr('class', 'tel_displayInline' + (_editPanel.status === 'OPEN' ? ' selected' : ''))
            .attr('data-filter-type', 'OPEN');
        statusDivOpen.append('span')
            .text('open');

        var statusDivSolved = statusForm.append('div')
            .attr('class', 'tel_displayInline' + (_editPanel.status === 'SOLVED' ? ' selected' : ''))
            .attr('data-filter-type', 'SOLVED');
        statusDivSolved.append('span')
            .text('solved');

        var statusDivInvalid = statusForm.append('div')
            .attr('class', 'tel_displayInline' + (_editPanel.status === 'INVALID' ? ' selected' : ''))
            .attr('data-filter-type', 'INVALID');
        statusDivInvalid.append('span')
            .text('invalid');
        //  END 1st container div

        //  START 2st container div
        var direction_form = presetFormContainer.append('div')
            .attr('class', 'form-field')
            .attr('id', 'dofFilter');
        var owHeadWrap = direction_form.append('label')
            .attr('class', 'form-label')
            .attr('for', 'oneWay')
            .text('One Way')
            .append('div')
            .attr('class', 'form-label-button-wrap')
            owHeadWrap.append('span').append('i')
                .attr('id', 'telenav-oneWay-headerDot');
            owHeadWrap.append('div')
            .attr('class', 'input')
            .append('input')
            .attr('type', 'checkbox')
            .attr('checked', 'checked')
            .attr('class', 'filterActivation')
            .attr('id', 'oneWay');
        var direction_formWrap = direction_form.append('form')
            .attr('class', 'filterForm optionsContainer');
        var direction_highlyProbableContainer = direction_formWrap.append('div')
            .attr('class', 'tel_displayInline');
        direction_highlyProbableContainer.append('input')
            .attr('id', 'C1')
            .attr('type', 'checkbox')
            .attr('checked', 'checked');
        direction_highlyProbableContainer.append('label')
            .attr('for', 'C1')
            .text('Highly Probable');
        var direction_mostLikelyContainer = direction_formWrap.append('div')
            .attr('class', 'tel_displayInline');
        direction_mostLikelyContainer.append('input')
            .attr('id', 'C2')
            .attr('type', 'checkbox');
        direction_mostLikelyContainer.append('label')
            .attr('for', 'C2')
            .text('Most Likely');
        var direction_probableContainer = direction_formWrap.append('div')
            .attr('class', 'tel_displayInline');
        direction_probableContainer.append('input')
            .attr('id', 'C3')
            .attr('type', 'checkbox');
        direction_probableContainer.append('label')
            .attr('for', 'C3')
            .text('Probable');

        var missing_form = presetFormContainer.append('div')
            .attr('class', 'form-field')
            .attr('id', 'mrFilter');
        var mrHeadWrap = missing_form.append('label')
            .attr('class', 'form-label')
            .attr('for', 'missingRoadType')
            .text('Missing roads')
            .append('div')
            .attr('class', 'form-label-button-wrap');
            mrHeadWrap.append('span').append('i')
                .attr('id', 'telenav-missingRoad-headerDot');
            mrHeadWrap.append('div')
            .attr('class', 'input')
            .append('input')
            .attr('type', 'checkbox')
            .attr('checked', 'checked')
            .attr('class', 'filterActivation')
            .attr('id', 'missingRoads');
        var missing_formWrap = missing_form.append('form')
            .attr('class', 'filterForm optionsContainer');
        var missing_roadContainer = missing_formWrap.append('div')
            .attr('class', 'tel_displayInline');
        missing_roadContainer.append('input')
            .attr('id', 'ROAD')
            .attr('type', 'checkbox')
            .attr('checked', 'checked');
        missing_roadContainer.append('label')
            .attr('id', 'telenav_roadMr')
            .attr('for', 'ROAD')
            .text('Road');
        var missing_parkingContainer = missing_formWrap.append('div')
            .attr('class', 'tel_displayInline');
        missing_parkingContainer.append('input')
            .attr('id', 'PARKING')
            .attr('type', 'checkbox');
        missing_parkingContainer.append('label')
            .attr('id', 'telenav_parkingMr')
            .attr('for', 'PARKING')
            .text('Parking');
        var missing_bothContainer = missing_formWrap.append('div')
            .attr('class', 'tel_displayInline');
        missing_bothContainer.append('input')
            .attr('id', 'BOTH')
            .attr('type', 'checkbox');
        missing_bothContainer.append('label')
            .attr('id', 'telenav_bothMr')
            .attr('for', 'BOTH')
            .text('Both');
        missing_formWrap.append('label')
            .attr('class', 'form-subLabel tel_displayBlock')
            .text('Filters');
        var missing_waterContainer = missing_formWrap.append('div')
            .attr('class', 'tel_displayInline');
        missing_waterContainer.append('input')
            .attr('id', 'WATER')
            .attr('type', 'checkbox');
        missing_waterContainer.append('label')
            .attr('id', 'telenav_waterMr')
            .attr('for', 'WATER')
            .text('Water Trail');
        var missing_pathContainer = missing_formWrap.append('div')
            .attr('class', 'tel_displayInline');
        missing_pathContainer.append('input')
            .attr('id', 'PATH')
            .attr('type', 'checkbox');
        missing_pathContainer.append('label')
            .attr('id', 'telenav_pathMr')
            .attr('for', 'PATH')
            .text('Path Trail');


        var restriction_form = presetFormContainer.append('div')
            .attr('class', 'form-field')
            .attr('id', 'trFilter');
        var trHeadWrap = restriction_form.append('label')
            .attr('class', 'form-label')
            .attr('for', 'missingRoads')
            .text('Turn Restriction')
            .append('div')
            .attr('class', 'form-label-button-wrap');
        trHeadWrap.append('span').append('i')
            .attr('id', 'telenav-turnRestriction-headerDot');
        trHeadWrap.append('div')
            .attr('class', 'input')
            .append('input')
            .attr('type', 'checkbox')
            .attr('checked', 'checked')
            .attr('class', 'filterActivation')
            .attr('id', 'turnRestriction');
        var restriction_formWrap = restriction_form.append('form')
            .attr('class', 'filterForm optionsContainer');
        var restriction_highlyProbableContainer = restriction_formWrap.append('div')
            .attr('class', 'tel_displayInline');
        restriction_highlyProbableContainer.append('input')
            .attr('id', 'C1')
            .attr('type', 'checkbox')
            .attr('checked', 'checked');
        restriction_highlyProbableContainer.append('label')
            .attr('for', 'C1')
            .text('Highly Probable');
        var restriction_probableContainer = restriction_formWrap.append('div')
            .attr('class', 'tel_displayInline');
        restriction_probableContainer.append('input')
            .attr('id', 'C2')
            .attr('type', 'checkbox');
        restriction_probableContainer.append('label')
            .attr('for', 'C2')
            .text('Probable');
        //  END 2st container div

        // ++++++++++++
        // events
        // ++++++++++++

        d3.select('#oneWay').on('click', function() {
            if (d3.select('#oneWay').property('checked')) {
                selectedTypes.push('dof');
                //---
                dofSelectedDetails = dofDetails.slice(0);
                d3.select('#dofFilter #C1').property('checked', true);
                d3.select('#dofFilter #C2').property('checked', true);
                d3.select('#dofFilter #C3').property('checked', true);
            } else {
                selectedTypes.splice(selectedTypes.indexOf('dof'), 1);
                //---
                dofSelectedDetails.length = 0;
                d3.select('#dofFilter #C1').property('checked', false);
                d3.select('#dofFilter #C2').property('checked', false);
                d3.select('#dofFilter #C3').property('checked', false);
            }
            render(d3.select('.layer-telenav'));
        });

        d3.selectAll('#dofFilter form input').on('click', function() {
            var allCheckboxes = d3.selectAll('#dofFilter form input')[0];
            if (d3.select('#dofFilter #' + d3.event.target.id).property('checked')) {
                if (!d3.select('#oneWay').property('checked')) {
                    d3.select('#oneWay').property('checked', true);
                    selectedTypes.push('dof');
                }
                dofSelectedDetails.push(d3.event.target.id);
            } else {
                var noneSelected = true;
                var checkedItems = d3.selectAll('#dofFilter form input:checked')[0];
                if (checkedItems.length == 0) {
                    d3.select('#oneWay').property('checked', false);
                    selectedTypes.splice(selectedTypes.indexOf('dof'), 1);
                }
                dofSelectedDetails.splice(dofSelectedDetails.indexOf(d3.event.target.id), 1);
            }
            render(d3.select('.layer-telenav'));
        });

        d3.selectAll('#mrFilter form input').on('click', function() {
            var allCheckboxes = d3.selectAll('#mrFilter form input')[0];
            if (d3.select('#mrFilter #' + d3.event.target.id).property('checked')) {
                if (!d3.select('#missingRoads').property('checked')) {
                    d3.select('#missingRoads').property('checked', true);
                    selectedTypes.push('mr');
                }
                mrSelectedDetails.push(d3.event.target.id);
            } else {
                var noneSelected = true;
                var checkedItems = d3.selectAll('#mrFilter form input:checked')[0];
                if (checkedItems.length == 0) {
                    d3.select('#missingRoads').property('checked', false);
                    selectedTypes.splice(selectedTypes.indexOf('mr'), 1);
                }
                mrSelectedDetails.splice(mrSelectedDetails.indexOf(d3.event.target.id), 1);
            }
            render(d3.select('.layer-telenav'));
        });

        d3.selectAll('#trFilter form input').on('click', function() {
            var allCheckboxes = d3.selectAll('#trFilter form input')[0];
            if (d3.select('#trFilter #' + d3.event.target.id).property('checked')) {
                if (!d3.select('#turnRestriction').property('checked')) {
                    d3.select('#turnRestriction').property('checked', true);
                    selectedTypes.push('tr');
                }
                trSelectedDetails.push(d3.event.target.id);
            } else {
                var noneSelected = true;
                var checkedItems = d3.selectAll('#trFilter form input:checked')[0];
                if (checkedItems.length == 0) {
                    d3.select('#turnRestriction').property('checked', false);
                    selectedTypes.splice(selectedTypes.indexOf('tr'), 1);
                }
                trSelectedDetails.splice(trSelectedDetails.indexOf(d3.event.target.id), 1);
            }
            render(d3.select('.layer-telenav'));
        });

        d3.select('#missingRoads').on('click', function() {
            if (d3.select('#missingRoads').property('checked')) {
                selectedTypes.push('mr');
                //---
                mrSelectedDetails = mrDetails.slice(0);
                d3.select('#mrFilter #ROAD').property('checked', true);
                d3.select('#mrFilter #PARKING').property('checked', true);
                d3.select('#mrFilter #BOTH').property('checked', true);
                d3.select('#mrFilter #WATER').property('checked', true);
                d3.select('#mrFilter #PATH').property('checked', true);
            } else {
                selectedTypes.splice(selectedTypes.indexOf('mr'), 1);
                //---
                mrSelectedDetails.length = 0;
                d3.select('#mrFilter #ROAD').property('checked', false);
                d3.select('#mrFilter #PARKING').property('checked', false);
                d3.select('#mrFilter #BOTH').property('checked', false);
                d3.select('#mrFilter #WATER').property('checked', false);
                d3.select('#mrFilter #PATH').property('checked', false);
            }
            render(d3.select('.layer-telenav'));
        });

        d3.select('#turnRestriction').on('click', function() {
            if (d3.select('#turnRestriction').property('checked')) {
                selectedTypes.push('tr');
                //---
                trSelectedDetails = trDetails.slice(0);
                d3.select('#trFilter #C1').property('checked', true);
                d3.select('#trFilter #C2').property('checked', true);
            } else {
                selectedTypes.splice(selectedTypes.indexOf('tr'), 1);
                //---
                trSelectedDetails.length = 0;
                d3.select('#trFilter #C1').property('checked', false);
                d3.select('#trFilter #C2').property('checked', false);
            }
            render(d3.select('.layer-telenav'));
        });

        d3.selectAll('#statusFilter div').on('click', function() {
            _editPanel.status = d3.event.currentTarget.getAttribute('data-filter-type');
            d3.selectAll('#statusFilter div').classed('selected', false);
            d3.select('#statusFilter div[data-filter-type=' + _editPanel.status + ']').classed('selected', true);
            render(d3.select('.layer-telenav'));
        });

        d3.select('#saveComment').on('click', _editPanel.saveComment);

        d3.selectAll('#statusSetter div').on('click', function() {
            var newStatus = d3.event.currentTarget.getAttribute('data-filter-type');
            d3.selectAll('#statusSetter div').classed('selected', false);
            d3.select('#statusSetter div[data-filter-type=' + _editPanel.status + ']').classed('selected', true);
            _editPanel.setStatus.call(_editPanel, newStatus);
        });

    }();

    return render;
};

