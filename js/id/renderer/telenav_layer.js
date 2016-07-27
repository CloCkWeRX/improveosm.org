iD.TelenavLayer = function (context) {

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
        //combinedItems = [],
        //selectedItems = [],

        visibleItems = null,

        status = 'OPEN',
        heatMap = null,
        requestCount;

    var types = {
        dof: 'http://fcd-ss.skobbler.net:2680/directionOfFlowService_test/search',
        mr: 'http://fcd-ss.skobbler.net:2680/missingGeoService_test/search',
        tr: 'http://fcd-ss.skobbler.net:2680/turnRestrictionService_test/search'
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

    // ==============================
    // ==============================
    // SelectedItems
    // ==============================
    // ==============================
    var SelectedItems = function(items) {
        // ---
        this.items = items;

        this.add = function(item) {
            this.items.push(item);
        };

        this.empty = function() {
            this.items.length = 0;
        };
        this.getSize = function() {
            return this.items.length;
        };
        this.getItem = function(index) {
            if (index >= this.items.length) {
                throw new Error('SelectedItems : getItem - problem');
            }
            return this.items[index];
        };
        this.getItemById = function(id) {
            var neededItem = null;
            for (var i = 0; i < this.items.length; i++) {
                if (this.items[i].id === id) {
                    neededItem = this.items[i];
                }
            }
            if (neededItem == null) {
                throw new Error('SelectedItems : getItemById - problem');
            }
            return neededItem;
        };

        this.removeItemById = function(id) {
            var neededItem = null;
            for (var i = 0; i < this.items.length; i++) {
                if (this.items[i].id === id) {
                    this.items.splice(i, 1);
                }
            }
            if (neededItem == null) {
                throw new Error('SelectedItems : removeItemById - problem');
            }
            return neededItem;
        };

        this.getSiblings = function(id, combinedItems) {
            var neededItem = null;
            for (var i = 0; i < this.items.length; i++) {
                if (this.items[i].id === id) {
                    neededItem = this.items[i];
                }
            }
            if (neededItem == null) {
                throw new Error('SelectedItems : getItemById - problem');
            }
            if (neededItem.className !== 'TurnRestrictionItem') {
                return {
                    siblings: [],
                    selected: null
                };
            }
            var siblings = [];
            var selected = null;
            for (var i = 0; i < combinedItems.length; i++) {
                if (combinedItems[i].className !== 'TurnRestrictionItem') {
                    continue;
                }
                if (
                    (combinedItems[i].point.lat === neededItem.point.lat) &&
                    (combinedItems[i].point.lon === neededItem.point.lon)
                ) {
                    if (combinedItems[i].id == neededItem.id) {
                        selected = neededItem.id;
                    }
                    siblings.push(combinedItems[i]);
                }
            }

            return {
                siblings: siblings,
                selected: selected
            };
        };

        this.update = function(combinedItems) {
            for (var i = 0; i < combinedItems.length; i++) {
                for (var j = 0; j < this.items.length; j++) {
                    if (combinedItems[i].id === this.items[j].id) {
                        if (!combinedItems[i].selected) {
                            combinedItems[i].selected = true;
                        }
                    }
                }
            }
        };

    };

    // ==============================
    // ==============================
    // TRNodes
    // ==============================
    // ==============================
    var TRNodes = function(nodes) {
        // ---
        this.nodes = nodes;

        this.render = function(combinedItems) {
            this.update(combinedItems);
            svg.selectAll('g.tr-node')
                .remove();
            for (var i = 0; i < this.nodes.length; i++) {
                var node = this.nodes[i];
                var cx = Math.floor(context.projection([node.lon, node.lat])[0]);
                var cy = Math.floor(context.projection([node.lon, node.lat])[1]);
                var gElem = svg.append('g').attr('class', 'tr-node');
                //var circleElem = gElem.append('circle')
                //    .attr('cx', cx)
                //    .attr('cy', cy)
                //    .attr('r', 10);
                var textElem = gElem.append('text')
                    .attr('x', cx - 5)
                    .attr('y', cy + 7)
                    .html(node.amount);
            }
        };

        this.update = function(combinedItems) {
            this.nodes.length = 0;
            var nodeMap = {};
            for (var i = 0; i < combinedItems.length; i++) {
                var item = combinedItems[i];
                if (item.className === 'TurnRestrictionItem') {
                    var key = item.point.lat + ',' + item.point.lon;
                    if (!nodeMap.hasOwnProperty(key)) {
                        var siblingsFound = 0;
                        for (var j = i + 1; j < combinedItems.length; j++) {
                            var checkedItem = combinedItems[j];
                            if (checkedItem.className === 'TurnRestrictionItem') {
                                if (
                                    (checkedItem.point.lat === item.point.lat) &&
                                    (checkedItem.point.lon === item.point.lon)
                                ) {
                                    siblingsFound++;
                                }
                            }
                        }
                        if (siblingsFound > 0) {
                            nodeMap[key] = siblingsFound + 1;
                        }
                    }
                }
            }
            for (var key in nodeMap) {
                if (nodeMap.hasOwnProperty(key)) {
                    var coordinates = key.split(',');
                    this.nodes.push({
                        lat: parseFloat(coordinates[0]),
                        lon: parseFloat(coordinates[1]),
                        amount: nodeMap[key]
                    });
                }
            }
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

        this.getClusteredItems = function() {

        };
    };

    var selectedItems2 = new SelectedItems([]);
    var trNodes = new TRNodes([]);

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

        this.select = function(select) {
            var node = d3.select('#' + this.id);
            node.classed('selected', select);
            this.selected = select;
        };
    };
    MapItem.transformClass = function(item) {
        if(item.className != 'MissingRoadItem') {
            return 'item ' + (item.selected ? 'selected ' : '') + item.className;
        } else {
            return 'item ' + (item.selected ? 'selected ' : '') + item.className + ' ' + item.status.toLowerCase() + ' ' + item.type.toLowerCase();
        }
    };
    MapItem.transformId = function(item) {
        return item.id;
    };
    MapItem.handleSelection = function(item) {
        var node = d3.select('#' + item.id);
        if (node.classed('selected')) {
        //if (item.selected) {
            if (d3.event.ctrlKey) {
                //node.classed('selected', false);
                item.select(false);
                //for (var i = 0; i < selectedItems.length; i++) {
                //    if (selectedItems[i].id === item.id) {
                //        selectedItems.splice(i, 1);
                //    }
                //}
                selectedItems2.removeItemById(item.id);
            } else {
                if (svg.selectAll('g.selected')[0].length === 1) {
                    //node.classed('selected', false);
                    item.select(false);
                    //selectedItems.length = 0;
                    selectedItems2.empty();
                } else {
                    svg.selectAll('g').classed('selected', false);
                    //selectedItems.length = 0;
                    selectedItems2.empty();
                    //node.classed('selected', true);
                    item.select(true);
                    //selectedItems.push(item);
                    selectedItems2.add(item);
                    //_editPanel.showSiblings(selectedItems2.getSiblings(item.id, combinedItems));
                    _editPanel.showSiblings(selectedItems2.getSiblings(item.id, visibleItems.items));
                }
            }
        } else {
            if (d3.event.ctrlKey) {
                //node.classed('selected', true);
                item.select(true);
                //////.attr('marker-end', 'url(#telenav-selected-arrow-marker)');/////???????? TODO
                //selectedItems.push(item);
                selectedItems2.add(item);
                //_editPanel.showSiblings(selectedItems2.getSiblings(item.id, combinedItems));
                _editPanel.showSiblings(selectedItems2.getSiblings(item.id, visibleItems.items));
            } else {
                svg.selectAll('g').classed('selected', false);
                //selectedItems.length = 0;
                selectedItems2.empty();
                //node.classed('selected', true);
                item.select(true);
                //selectedItems.push(item);
                selectedItems2.add(item);
                //_editPanel.showSiblings(selectedItems2.getSiblings(item.id, combinedItems));
                _editPanel.showSiblings(selectedItems2.getSiblings(item.id, visibleItems.items));
            }
        }
        d3.event.stopPropagation();
        if (selectedItems2.getSize() === 0) {
        //if (selectedItems.length === 0) {
            _editPanel.goToMain();
        } else {
            _editPanel.goToEdit(item);
            _editPanel.selectedItemDetails(item);
        }
    };
    MapItem.handleMouseOver = function(item) {
        item.highlight(item, true);
    };
    MapItem.handleMouseOut = function(item) {
        item.highlight(item, false);
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

        this.highlight = function(item, highlight) {

        };
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
            return {
                val: rawItemData.segments[0].numberOfTrips,
                x: Math.floor(context.projection([x, y])[0]),
                y: Math.floor(context.projection([x, y])[1])
            }
        };
        this.getOutNo = function() {
            var last = rawItemData.segments[1].points.length - 1;
            var x = rawItemData.segments[1].points[last].lon;
            var y = rawItemData.segments[1].points[last].lat;
            return {
                val: rawItemData.numberOfPasses,
                x: Math.floor(context.projection([x, y])[0]),
                y: Math.floor(context.projection([x, y])[1])
            }
        };
        this.highlight = function(item, highlight) {
            d3.selectAll('#' + item.id)
                .classed('highlightOn', highlight)
                .classed('highlightOff', !highlight);
        };
    };
    // static
    TurnRestrictionItem.getDistance = function(p1, p2) {

        var x1 = Math.floor(context.projection([p1.lon, p1.lat])[0]);
        var y1 = Math.floor(context.projection([p1.lon, p1.lat])[1]);

        var x2 = Math.floor(context.projection([p2.lon, p2.lat])[0]);
        var y2 = Math.floor(context.projection([p2.lon, p2.lat])[1]);

        var a = x1 - x2;
        var b = y1 - y2;

        return Math.sqrt(a * a + b * b);
    };
    TurnRestrictionItem.findMiddle = function(p1, p2, d, dif) {
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
    TurnRestrictionItem.splitSegment = function(segment) {
        var length = 0;
        var distances = [];
        for (var i = 0; i < segment.length - 1; i++) {
            var d = TurnRestrictionItem.getDistance(segment[i], segment[i + 1]);
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

        var newPoint = TurnRestrictionItem.findMiddle(
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
    TurnRestrictionItem.prototype = new MapItem();
    TurnRestrictionItem.transformX = function(item) {
        return Math.floor(context.projection([item.point.lon, item.point.lat])[0]);
    };
    TurnRestrictionItem.transformY= function(item) {
        return Math.floor(context.projection([item.point.lon, item.point.lat])[1]);
    };
    TurnRestrictionItem.transformLinePoints = function(item) {
        var stringPoints = [];
        for (var i = 0; i < item.segments.length; i++) {
            for (var j = 0; j < item.segments[i].points.length; j++) {
                var point = context.projection([item.segments[i].points[j].lon, item.segments[i].points[j].lat]);
                stringPoints.push(point.toString());
            }
        }

        return stringPoints.join(' ');
    };
    TurnRestrictionItem.transformLinePointsOut = function(item) {
        var rawSegments = [];
        for (var i = 1; i < item.segments.length; i++) {
            var rawPoints = [];
            for (var j = 0; j < item.segments[i].points.length; j++) {
                //var point = context.projection([item.segments[i].points[j].lon, item.segments[i].points[j].lat]);
                rawPoints.push(item.segments[i].points[j]);
            }
            rawSegments.push(rawPoints);
        }

        var segments = Utils.orderSegments(rawSegments, item.point);

        var stringPoints = [];
        for (var i = 0; i < segments.length; i++) {
            for (var j = 0; j < segments[i].length; j++) {
                var point = context.projection([segments[i][j].lon, segments[i][j].lat]);
                stringPoints.push(point.toString());
            }
        }

        return stringPoints.join(' ');
    };
    TurnRestrictionItem.transformLinePointsIn1 = function(item) {
        var stringPoints = [];
        var split = TurnRestrictionItem.splitSegment(item.segments[0].points);
        for (var j = 0; j < item.segments[0].points.length; j++) {
            var point = context.projection([item.segments[0].points[j].lon, item.segments[0].points[j].lat]);
            stringPoints.push(point.toString());
        }
        stringPoints.splice(split.index + 1, 0, split.newPoint);
        stringPoints.splice(split.index + 2, stringPoints.length - (split.index + 1));
        return stringPoints.join(' ');
    };
    TurnRestrictionItem.transformLinePointsIn2 = function(item) {
        var stringPoints = [];
        var split = TurnRestrictionItem.splitSegment(item.segments[0].points);
        for (var j = 0; j < item.segments[0].points.length; j++) {
            var point = context.projection([item.segments[0].points[j].lon, item.segments[0].points[j].lat]);
            stringPoints.push(point.toString());
        }
        stringPoints.splice(split.index + 1, 0, split.newPoint);
        stringPoints.splice(0, split.index + 1);
        return stringPoints.join(' ');
    };
    TurnRestrictionItem.transformInNoX = function(item) {
        return Math.floor(context.projection([lon, lat])[0]);
    };
    TurnRestrictionItem.transformInNoY = function(item) {
        return Math.floor(context.projection([lon, lat])[1]);
    };
    TurnRestrictionItem.transformInNoX = function(item) {
        return item.getInNo().x - 10;
    };
    TurnRestrictionItem.transformInNoY = function(item) {
        return item.getInNo().y - 25;
    };
    TurnRestrictionItem.transformInNo = function(item) {
        return item.getInNo().val;
    };
    TurnRestrictionItem.transformOutNoX = function(item) {
        return item.getOutNo().x - 10;
    };
    TurnRestrictionItem.transformOutNoY = function(item) {
        return item.getOutNo().y - 25;
    };
    TurnRestrictionItem.transformOutNo = function(item) {
        return item.getOutNo().val;
    };

    TurnRestrictionItem.transformInNoRectX = function(item) {
        return item.getInNo().x - 13;
    };
    TurnRestrictionItem.transformInNoRectY = function(item) {
        return item.getInNo().y - 36;
    };
    TurnRestrictionItem.transformOutNoRectX = function(item) {
        return item.getOutNo().x - 13;
    };
    TurnRestrictionItem.transformOutNoRectY = function(item) {
        return item.getOutNo().y - 36;
    };
    TurnRestrictionItem.transformInNoRectWidth = function(item) {
        return (item.getInNo().val.toString().length * 6) + 6;
    };
    TurnRestrictionItem.transformOutNoRectWidth = function(item) {
        return (item.getOutNo().val.toString().length * 6) + 6;
    };
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
        this.highlight = function(item, highlight) {
            d3.selectAll('#' + item.id)
                .classed('highlightOn', highlight)
                .classed('highlightOff', !highlight);
        };
    };
    MissingRoadItem.prototype = new MapItem();
    MissingRoadItem.computeX = function(lat, lon) {
        return Math.floor(context.projection([lon, lat])[0]);
    };
    MissingRoadItem.computeY = function(lat, lon) {
        return Math.floor(context.projection([lon, lat])[1]);
    };
    MissingRoadItem.transformTileX = function(item) {
        var squareCoords = Utils.getTileSquare(item.getX(), item.getY());
        var startLat = squareCoords.latMax;
        var startLon = squareCoords.lonMin;
        return Math.floor(context.projection([startLon, startLat])[0]);
    };
    MissingRoadItem.transformTileY = function(item) {
        var squareCoords = Utils.getTileSquare(item.getX(), item.getY());
        var startLat = squareCoords.latMax;
        var startLon = squareCoords.lonMin;
        return Math.floor(context.projection([startLon, startLat])[1]);
    };
    MissingRoadItem.transformTileWidth = function(item) {
        var squareCoords = Utils.getTileSquare(item.getX(), item.getY());
        var startLat = squareCoords.latMax;
        var startLon = squareCoords.lonMin;
        var startX = Math.floor(context.projection([startLon, startLat])[0]);
        var endLat = squareCoords.latMin;
        var endLon = squareCoords.lonMax;
        var endX = Math.floor(context.projection([endLon, endLat])[0]);
        return Math.abs(endX - startX);
    };
    MissingRoadItem.transformTileHeight = function(item) {
        var squareCoords = Utils.getTileSquare(item.getX(), item.getY());
        var startLat = squareCoords.latMax;
        var startLon = squareCoords.lonMin;
        var startY = Math.floor(context.projection([startLon, startLat])[1]);
        var endLat = squareCoords.latMin;
        var endLon = squareCoords.lonMax;
        var endY = Math.floor(context.projection([endLon, endLat])[1]);
        return Math.abs(endY - startY);
    };

    MissingRoadItem.computeTileX = function(x, y) {
        var squareCoords = Utils.getTileSquare(x, y);
        var startLat = squareCoords.latMax;
        var startLon = squareCoords.lonMin;
        return Math.floor(context.projection([startLon, startLat])[0]);
    };
    MissingRoadItem.computeTileY = function(x, y) {
        var squareCoords = Utils.getTileSquare(x, y);
        var startLat = squareCoords.latMax;
        var startLon = squareCoords.lonMin;
        return Math.floor(context.projection([startLon, startLat])[1]);
    };
    MissingRoadItem.computeTileWidth = function(x, y) {
        var squareCoords = Utils.getTileSquare(x, y);
        var startLat = squareCoords.latMax;
        var startLon = squareCoords.lonMin;
        var startX = Math.floor(context.projection([startLon, startLat])[0]);
        var endLat = squareCoords.latMin;
        var endLon = squareCoords.lonMax;
        var endX = Math.floor(context.projection([endLon, endLat])[0]);
        return Math.abs(endX - startX);
    };
    MissingRoadItem.computeTileHeight = function(x, y) {
        var squareCoords = Utils.getTileSquare(x, y);
        var startLat = squareCoords.latMax;
        var startLon = squareCoords.lonMin;
        var startY = Math.floor(context.projection([startLon, startLat])[1]);
        var endLat = squareCoords.latMin;
        var endLon = squareCoords.lonMax;
        var endY = Math.floor(context.projection([endLon, endLat])[1]);
        return Math.abs(endY - startY);
    };

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
        this.highlight = function(item, highlight) {
            //d3.selectAll('#' + item.id)
            //    .classed('highlightOn', highlight)
            //    .classed('highlightOff', !highlight)
            //    .attr('marker-end', highlight ? 'url(#telenav-selected-arrow-marker)' : null);
        };

    };
    DirectionOfFlowItem.prototype = new MapItem();
    DirectionOfFlowItem.transformLinePoints = function(item) {
        var stringPoints = [];
        for (var i = 0; i < item.getPoints().length; i++) {
            var point = context.projection([item.getPoints()[i].lon, item.getPoints()[i].lat]);
            stringPoints.push(point.toString());
        }
        return stringPoints.join(' ');
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
    };
    ClusterCircle.transformClass = function(cluster) {
        return cluster.className;
    };
    ClusterCircle.transformType = function(cluster) {
        return cluster.type;
    };
    ClusterCircle.transformX = function(cluster) {
        return Math.floor(context.projection([cluster.point.lon, cluster.point.lat])[0]);
    };
    ClusterCircle.transformY = function(cluster) {
        return Math.floor(context.projection([cluster.point.lon, cluster.point.lat])[1]);
    };
    ClusterCircle.transformR = function(cluster) {
        return cluster.pixelRadius;
    };

    // ==============================
    // ==============================
    // ClusterCircle
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
        this.editMode = false;

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
            svg.selectAll('g').classed('selected', false);
            //selectedItems.length = 0;
            selectedItems2.empty();
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
            var selected = siblings.selected,
                selectedConfidenceLvl;
            siblings = siblings.siblings;
            if (siblings.length > 1) {
                d3.select('#siblingsPanel').classed('hide', false);
                var listElement = d3.select('#siblingsList');
                listElement.html('');
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
                        //for (var i = 0; i < combinedItems.length; i++) {
                        //    if (combinedItems[i].id === d3.event.currentTarget.attributes[0].nodeValue) {
                        //        item = combinedItems[i];
                        //    }
                        //}
                        for (var i = 0; i < visibleItems.items.length; i++) {
                            if (visibleItems.items[i].id === d3.event.currentTarget.attributes[0].nodeValue) {
                                item = visibleItems.items[i];
                            }
                        }
                        MapItem.handleSelection(item);
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
            switch (item.status) {
                case 'OPEN':
                    d3.select('#ch_open').attr('checked', 'checked');
                    d3.select('#ch_solved').attr('checked', null);
                    d3.select('#ch_invalid').attr('checked', null);
                    break;
                case 'SOLVED':
                    d3.select('#ch_open').attr('checked', null);
                    d3.select('#ch_solved').attr('checked', 'checked');
                    d3.select('#ch_invalid').attr('checked', null);
                    break;
                case 'INVALID':
                    d3.select('#ch_open').attr('checked', null);
                    d3.select('#ch_solved').attr('checked', null);
                    d3.select('#ch_invalid').attr('checked', 'checked');
                    break;
            }
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

                //var userLink = d3.select(document.createElement('div'));
                //
                //if (user.image_url) {
                //    userLink.append('img')
                //        .attr('src', user.image_url)
                //        .attr('class', 'icon pre-text user-icon');
                //}
                //
                //userLink.append('a')
                //    .attr('class','user-info')
                //    .text(user.display_name)
                //    .attr('href', context.connection().userURL(user.display_name))
                //    .attr('tabindex', -1)
                //    .attr('target', '_blank');
                //
                //prose.html(t('commit.upload_explanation_with_user', {user: userLink.html()}));

                status = status.toUpperCase();
                //for (var i = 0; i < selectedItems.length; i++) {
                for (var i = 0; i < selectedItems2.getSize(); i++) {
                    //var currentItem = selectedItems[i];
                    var currentItem = selectedItems2.getItem(i);

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
                            d3.xhr('http://fcd-ss.skobbler.net:2680/directionOfFlowService_test/comment')
                                .header("Content-Type", "application/json")
                                .post(
                                    JSON.stringify(dataToPost),
                                    responseHandler
                                );
                            break;
                        case 'MissingRoadItem':
                            dataToPost.tiles = currentItem.getIdentifier();
                            d3.xhr('http://fcd-ss.skobbler.net:2680/missingGeoService_test/comment')
                                .header("Content-Type", "application/json")
                                .post(
                                    JSON.stringify(dataToPost),
                                    responseHandler
                                );
                            break;
                        case 'TurnRestrictionItem':
                            dataToPost.targetIds = currentItem.getIdentifier();
                            d3.xhr('http://fcd-ss.skobbler.net:2680/turnRestrictionService_test/comment')
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

                //for (var i = 0; i < selectedItems.length; i++) {
                for (var i = 0; i < selectedItems2.getSize(); i++) {
                //    var currentItem = selectedItems[i];
                    var currentItem = selectedItems2.getItem(i);

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
                            d3.xhr('http://fcd-ss.skobbler.net:2680/directionOfFlowService_test/comment')
                                .header("Content-Type", "application/json")
                                .post(
                                    JSON.stringify(dataToPost),
                                    responseHandler
                                );
                            break;
                        case 'MissingRoadItem':
                            dataToPost.tiles = currentItem.getIdentifier();
                            d3.xhr('http://fcd-ss.skobbler.net:2680/missingGeoService_test/comment')
                                .header("Content-Type", "application/json")
                                .post(
                                    JSON.stringify(dataToPost),
                                    responseHandler
                                );
                            break;
                        case 'TurnRestrictionItem':
                            dataToPost.targetIds = currentItem.getIdentifier();
                            d3.xhr('http://fcd-ss.skobbler.net:2680/turnRestrictionService_test/comment')
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
                    //return item;
                });

            var enter = g.enter().append('g')
                .attr('class', ClusterCircle.transformClass)
                .classed('cluster', true)
                .attr('id', ClusterCircle.transformId);

            var circle = enter.append('circle')
                .attr('class', ClusterCircle.transformType)
                .attr('cx', ClusterCircle.transformX)
                .attr('cy', ClusterCircle.transformY)
                .attr('r', ClusterCircle.transformR);

            g.exit()
                .remove();
        }
    };

    var _synchCallbacks = function(error, data) {

        if (data.hasOwnProperty('roadSegments')) {
            visibleItems.loadOneWays(data.roadSegments);
            //for (var i = 0; i < data.roadSegments.length; i++) {
            //    combinedItems.push(new DirectionOfFlowItem(
            //        data.roadSegments[i]
            //    ));
            //}

        }
        if (data.hasOwnProperty('tiles')) {
            visibleItems.loadMissingRoads(data.tiles);
            //for (var i = 0; i < data.tiles.length; i++) {
            //    combinedItems.push(new MissingRoadItem(
            //        data.tiles[i]
            //    ));
            //}
        }
        if (data.hasOwnProperty('entities')) {
            visibleItems.loadTurnRestrictions(data.entities);
            //for (var i = 0; i < data.entities.length; i++) {
            //    combinedItems.push(new TurnRestrictionItem(
            //        data.entities[i]
            //    ));
            //}
        }



        if (!--requestCount) {
            if (error) {
                svg.selectAll('g.item')
                    .remove();
                return;
            }
            selectedItems2.update(visibleItems.items);

            var g = svg.selectAll('g.item')
                .data(visibleItems.items, function(item) {
                    return item.id;
                    //return item;
                });


            var enter = g.enter().append('g')
                .attr('class', MapItem.transformClass)
                .attr('id', MapItem.transformId);

            var dOFs = enter.filter(function(item) {
                return item.isA('DirectionOfFlowItem');
            });
            var mRs = enter.filter(function(item) {
                return item.isA('MissingRoadItem');
            });
            var tRs = enter.filter(function(item) {
                return item.isA('TurnRestrictionItem');
            });

            var dofPoly = dOFs.append('polyline').attr('class', 'main');
            dofPoly.attr('points', DirectionOfFlowItem.transformLinePoints);
            var owHighlight = dOFs.append('polyline').attr('class', 'selectable');
            owHighlight.attr('points', DirectionOfFlowItem.transformLinePoints);

            mRs.html(function(d) {
                var html = '';
                html += '<rect x=' + MissingRoadItem.computeTileX(d.getX(), d.getY())
                    + ' y=' + MissingRoadItem.computeTileY(d.getX(), d.getY())
                    + ' width=' + MissingRoadItem.computeTileWidth(d.getX(), d.getY())
                    + ' height=' + MissingRoadItem.computeTileHeight(d.getX(), d.getY())
                    + '></rect>';
                for (var i = 0; i < d._points.length; i++) {
                    var cx = MissingRoadItem.computeX(d._points[i].lat, d._points[i].lon);
                    var cy = MissingRoadItem.computeY(d._points[i].lat, d._points[i].lon);
                    html += '<circle cx=' + cx + ' cy=' + cy + ' r=3></circle>';
                }
                html += '<rect x=' + MissingRoadItem.computeTileX(d.getX(), d.getY())
                    + ' y=' + MissingRoadItem.computeTileY(d.getX(), d.getY())
                    + ' width=' + MissingRoadItem.computeTileWidth(d.getX(), d.getY())
                    + ' height=' + MissingRoadItem.computeTileHeight(d.getX(), d.getY())
                    + ' class="selectable"'
                    + '></rect>';
                return html;
            });

            var trPolyIn1 = tRs.append('polyline');
            trPolyIn1.attr('points', TurnRestrictionItem.transformLinePointsIn1);
            trPolyIn1.attr('class', 'wayIn1');
            var trPolyIn2 = tRs.append('polyline');
            trPolyIn2.attr('points', TurnRestrictionItem.transformLinePointsIn2);
            trPolyIn2.attr('class', 'wayIn2');
            tRs.append('rect').attr('class', 'noInRect')
                .attr('width', TurnRestrictionItem.transformInNoRectWidth)
                .attr('x', TurnRestrictionItem.transformInNoRectX)
                .attr('y', TurnRestrictionItem.transformInNoRectY);
            tRs.append('text').attr('class', 'inNo')
                .attr('x', TurnRestrictionItem.transformInNoX)
                .attr('y', TurnRestrictionItem.transformInNoY)
                .html(TurnRestrictionItem.transformInNo);
            tRs.append('rect').attr('class', 'noOutRect')
                .attr('width', TurnRestrictionItem.transformOutNoRectWidth)
                .attr('x', TurnRestrictionItem.transformOutNoRectX)
                .attr('y', TurnRestrictionItem.transformOutNoRectY);
            tRs.append('text').attr('class', 'outNo')
                .attr('x', TurnRestrictionItem.transformOutNoX)
                .attr('y', TurnRestrictionItem.transformOutNoY)
                .html(TurnRestrictionItem.transformOutNo);
            var trPolyOut = tRs.append('polyline');
            trPolyOut.attr('points', TurnRestrictionItem.transformLinePointsOut);
            //trPolyOut.attr('marker-start', 'url(#telenav-tr-marker)');
            trPolyOut.attr('class', 'wayOut');
            var trCircle = tRs.append('circle')
                .attr('class', 'telenav-tr-marker')
                .attr('cx', TurnRestrictionItem.transformX)
                .attr('cy', TurnRestrictionItem.transformY)
                .attr('r', '20');
            var trSelCircle = tRs.append('circle').attr('class', 'selectable')
                .attr('cx', TurnRestrictionItem.transformX)
                .attr('cy', TurnRestrictionItem.transformY)
                .attr('r', '20');

            dOFs.on('click', MapItem.handleSelection);
            mRs.on('click', MapItem.handleSelection);
            tRs.on('click', MapItem.handleSelection);

            //dOFs.on('mouseover', MapItem.handleMouseOver);
            //mRs.on('mouseover', MapItem.handleMouseOver);
            //tRs.on('mouseover', MapItem.handleMouseOver);

            //dOFs.on('mouseout', MapItem.handleMouseOut);
            //mRs.on('mouseout', MapItem.handleMouseOut);
            //tRs.on('mouseout', MapItem.handleMouseOut);

            trNodes.render(visibleItems.items);

            g.exit()
                .remove();
        }

    };

    function render(selection) {

        var zoom = Math.floor(context.map().zoom());

        //if (zoom >= 15) {
            d3.select("#sidebar").classed('telenavPaneActive', enable);
            d3.select(".pane-telenav").classed('hidden', !enable);
        //} else {
            //d3.select("#sidebar").classed('telenavPaneActive', false);
            //d3.select(".pane-telenav").classed('hidden', true);
        //}

        svg = selection.selectAll('svg')
            .data([0]);

        svg.enter().append('svg');

        // *****************************
        // HANDLING OF CLICK DESELECTION
        // *****************************
        svg.selectAll('g.deselectSurface')
            .remove();
        var deselectionRectangle = svg
            .insert('g', ':first-child')
                .attr('class', 'deselectSurface')
                .append('rect')
                    .attr('width', svg.attr('width'))
                    .attr('height', svg.attr('height'));
        deselectionRectangle.on('click', function() {
            if (selectedItems2.getSize() > 0) {
                svg.selectAll('g').classed('selected', false);
                selectedItems2.empty();
                _editPanel.goToMain();
            }
        });

        // *****************************
        // HANDLING OF CLICK DESELECTION
        // *****************************

        svg.style('display', enable ? 'block' : 'none');


        if (!enable) {

            svg.selectAll('g.item')
                .remove();
            svg.selectAll('g.cluster')
                .remove();

            return;
        }

        var clusterCircles = svg.selectAll('.ClusterCircle > circle');
        clusterCircles.attr('cx', ClusterCircle.transformX);
        clusterCircles.attr('cy', ClusterCircle.transformY);

        var directionOfFlowPolylines = svg.selectAll('.DirectionOfFlowItem > polyline.main');
        directionOfFlowPolylines.attr('points', DirectionOfFlowItem.transformLinePoints);
        var owHighlight = svg.selectAll('.DirectionOfFlowItem > polyline.selectable');
        owHighlight.attr('points', DirectionOfFlowItem.transformLinePoints);

        var missingRoadsCircles = svg.selectAll('.MissingRoadItem');
        missingRoadsCircles.html(function(d) {
            var html = '';
            html += '<rect x=' + MissingRoadItem.computeTileX(d.getX(), d.getY())
                + ' y=' + MissingRoadItem.computeTileY(d.getX(), d.getY())
                + ' width=' + MissingRoadItem.computeTileWidth(d.getX(), d.getY())
                + ' height=' + MissingRoadItem.computeTileHeight(d.getX(), d.getY())
                + '></rect>';
            for (var i = 0; i < d._points.length; i++) {
                var cx = MissingRoadItem.computeX(d._points[i].lat, d._points[i].lon);
                var cy = MissingRoadItem.computeY(d._points[i].lat, d._points[i].lon);
                html += '<circle cx=' + cx + ' cy=' + cy + ' r=3></circle>';
            }
            html += '<rect x=' + MissingRoadItem.computeTileX(d.getX(), d.getY())
                + ' y=' + MissingRoadItem.computeTileY(d.getX(), d.getY())
                + ' width=' + MissingRoadItem.computeTileWidth(d.getX(), d.getY())
                + ' height=' + MissingRoadItem.computeTileHeight(d.getX(), d.getY())
                + ' class="selectable"'
                + '></rect>';
            return html;
        });

        var trCircle = svg.selectAll('.TurnRestrictionItem > circle');
        trCircle.attr('cx', TurnRestrictionItem.transformX);
        trCircle.attr('cy', TurnRestrictionItem.transformY);
        var trSelCircle = svg.selectAll('.TurnRestrictionItem > circle.selectable');
        trSelCircle.attr('cx', TurnRestrictionItem.transformX);
        trSelCircle.attr('cy', TurnRestrictionItem.transformY);
        var turnRestrictionPolylinesIn1 = svg.selectAll('.TurnRestrictionItem > polyline.wayIn1');
        turnRestrictionPolylinesIn1.attr('points', TurnRestrictionItem.transformLinePointsIn1);
        var turnRestrictionPolylinesIn2 = svg.selectAll('.TurnRestrictionItem > polyline.wayIn2');
        turnRestrictionPolylinesIn2.attr('points', TurnRestrictionItem.transformLinePointsIn2);
        var turnRestrictionPolylinesOut = svg.selectAll('.TurnRestrictionItem > polyline.wayOut');
        turnRestrictionPolylinesOut.attr('points', TurnRestrictionItem.transformLinePointsOut);
        //var turnRestrictionPolylinesHighlight = svg.selectAll('.TurnRestrictionItem > polyline.highlight');
        //turnRestrictionPolylinesHighlight.attr('points', TurnRestrictionItem.transformLinePoints);

        var tRinNo = svg.selectAll('.TurnRestrictionItem > text.inNo');
        tRinNo
            .attr('x', TurnRestrictionItem.transformInNoX)
            .attr('y', TurnRestrictionItem.transformInNoY)
            .html(TurnRestrictionItem.transformInNo);
        var tRinNoInRect = svg.selectAll('.TurnRestrictionItem > rect.noInRect');
        tRinNoInRect
            .attr('x', TurnRestrictionItem.transformInNoRectX)
            .attr('y', TurnRestrictionItem.transformInNoRectY);
        var tRinNo = svg.selectAll('.TurnRestrictionItem > text.outNo');
        tRinNo
            .attr('x', TurnRestrictionItem.transformOutNoX)
            .attr('y', TurnRestrictionItem.transformOutNoY)
            .html(TurnRestrictionItem.transformOutNo);
        var tRinNoOutRect = svg.selectAll('.TurnRestrictionItem > rect.noOutRect');
        tRinNoOutRect
            .attr('x', TurnRestrictionItem.transformOutNoRectX)
            .attr('y', TurnRestrictionItem.transformOutNoRectY);

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
                types[selectedTypes[i]] + boundingBoxUrlFragments + typesFragments + '&status=' + status + '&client=WEBAPP&version=1.2'
            );
            pushedTypes.push(selectedTypes[i]);
        }

        requestCount = requestUrlQueue.length;
        //combinedItems.length = 0;
        visibleItems = new VisibleItems();

        if ((zoom > 14) && (requestUrlQueue.length !== 0)) {
            svg.selectAll('g.cluster')
                .remove();
            for (var i = 0; i < requestUrlQueue.length; i++) {
                requestQueue[i] = d3.json(requestUrlQueue[i], _synchCallbacks);
            }
            _editPanel.enableActivationSwitch(true);
        } else if (requestUrlQueue.length !== 0) {
            svg.selectAll('g.item')
                .remove();
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
            svg.selectAll('g.item')
                .remove();
            svg.selectAll('g.cluster')
                .remove();
        }
    }

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
        //userWindowHeader.append('button')
        //    .attr('class', 'fr preset-reset')
        //    .on('click', function() {
        //        _editPanel.deselectAll();
        //        render(d3.select('.layer-telenav'));
        //        //telenavWrap.transition()
        //        //    .style('transform', 'translate3d(0px, 0px, 0px)');
        //    })
        //    .append('span')
        //    .html('&#9658;');

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
            .attr('class', 'filterForm optionsContainer');
        var statusUpdate_openContainer = statusUpdate_formWrap.append('div')
            .attr('class', 'tel_displayInline')
            .attr('id', 'setOpen');
        statusUpdate_openContainer.append('input')
            .attr('id', 'ch_open')
            .attr('name', 'changeStatus')
            .attr('value', 'OPEN')
            .attr('type', 'radio');
        statusUpdate_openContainer.append('label')
            .attr('for', 'ch_open')
            .text('Open');
        var statusUpdate_solvedContainer = statusUpdate_formWrap.append('div')
            .attr('class', 'tel_displayInline')
            .attr('id', 'setSolved');
        statusUpdate_solvedContainer.append('input')
            .attr('id', 'ch_solved')
            .attr('name', 'changeStatus')
            .attr('value', 'SOLVED')
            .attr('type', 'radio');
        statusUpdate_solvedContainer.append('label')
            .attr('for', 'ch_solved')
            .text('Solved');
        var statusUpdate_invalidContainer = statusUpdate_formWrap.append('div')
            .attr('class', 'tel_displayInline')
            .attr('id', 'setInvalid');
        statusUpdate_invalidContainer.append('input')
            .attr('id', 'ch_invalid')
            .attr('name', 'changeStatus')
            .attr('value', 'INVALID')
            .attr('type', 'radio');
        statusUpdate_invalidContainer.append('label')
            .attr('for', 'ch_invalid')
            .text('Invalid');

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
        //generalWindowsWindowHeader.append('button')
        //    .attr('class', 'fr preset-reset')
        //    .on('click', function() {
        //        _editPanel.goToMore();
        //        //telenavWrap.transition()
        //        //    .style('transform', 'translate3d(-' + panelWidth() + 'px, 0px,  0px)');
        //    })
        //    .append('span')
        //    .html('&#9658;');
        generalWindowsWindowHeader.append('h3')
            .attr('class', 'main-header')
            .text('Improve OSM panel');
        var switchWrapper = generalWindowsWindowHeader.append('div')
            .attr('class', 'button-wrap joined fr')
        switchWrapper.append('button')
            .attr('class', 'telenav-header-button active')
            .attr('id', 'telenav-active')
            .append('span')
            .text('Active');
        switchWrapper.append('button')
            .attr('class', 'telenav-header-button inactive selected')
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
            .attr('class', 'tel_displayInline');
        statusDivOpen.append('label')
            .attr('for', 'OPEN')
            .text('open');
        statusDivOpen.append('input')
            .attr('type', 'radio')
            .attr('id', 'OPEN')
            .attr('class', 'filterItem')
            .attr('name', 'filter')
            .attr('checked', 'checked');

        var statusDivSolved = statusForm.append('div')
            .attr('class', 'tel_displayInline');
        statusDivSolved.append('label')
            .attr('for', 'SOLVED')
            .text('solved');
        statusDivSolved.append('input')
            .attr('type', 'radio')
            .attr('id', 'SOLVED')
            .attr('class', 'filterItem')
            .attr('name', 'filter');

        var statusDivInvalid = statusForm.append('div')
            .attr('class', 'tel_displayInline');
        statusDivInvalid.append('label')
            .attr('for', 'INVALID')
            .text('invalid');
        statusDivInvalid.append('input')
            .attr('type', 'radio')
            .attr('id', 'INVALID')
            .attr('class', 'filterItem')
            .attr('name', 'filter');
        //  END 1st container div

        //  START 2st container div
        //var optionsWindow = telenavWrap.append('div')
        //    .attr('id', 'optionsWindow')
        //    .attr('class', 'entity-editor-pane pane');
        //var optionsWindowHeader = optionsWindow.append('div')
        //    .attr('class', 'header fillL cf');
        //optionsWindowHeader.append('button')
        //    .attr('class', 'fl preset-reset preset-choose')
        //    .on('click', function() {
        //        _editPanel.goToMain();
        //    })
        //    .append('span')
        //    .html('&#9668;');
        //
        //optionsWindowHeader.append('h3')
        //    .text('Telenav Layers');
        //var optionsWindowBody = optionsWindow.append('div')
        //    .attr('class', 'telenav-body');
        //var optionsWindowInner = optionsWindowBody.append('div')
        //    .attr('class', 'inspector-border inspector-preset')
        //    .append('div');
        //var optionsContainer = optionsWindowInner.append('div')
        //    .attr('class', 'preset-form inspector-inner');

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
            .attr('type', 'checkbox')
            //.attr('checked', 'checked');
        direction_mostLikelyContainer.append('label')
            .attr('for', 'C2')
            .text('Most Likely');
        var direction_probableContainer = direction_formWrap.append('div')
            .attr('class', 'tel_displayInline');
        direction_probableContainer.append('input')
            .attr('id', 'C3')
            .attr('type', 'checkbox')
            //.attr('checked', 'checked');
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
            .attr('class', 'form-label-button-wrap')
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
            .attr('type', 'checkbox')
            //.attr('checked', 'checked');
        missing_parkingContainer.append('label')
            .attr('id', 'telenav_parkingMr')
            .attr('for', 'PARKING')
            .text('Parking');
        var missing_bothContainer = missing_formWrap.append('div')
            .attr('class', 'tel_displayInline');
        missing_bothContainer.append('input')
            .attr('id', 'BOTH')
            .attr('type', 'checkbox')
            //.attr('checked', 'checked');
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
            .attr('type', 'checkbox')
            //.attr('checked', 'checked');
        missing_waterContainer.append('label')
            .attr('id', 'telenav_waterMr')
            .attr('for', 'WATER')
            .text('Water Trail');
        var missing_pathContainer = missing_formWrap.append('div')
            .attr('class', 'tel_displayInline');
        missing_pathContainer.append('input')
            .attr('id', 'PATH')
            .attr('type', 'checkbox')
            //.attr('checked', 'checked');
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
            .attr('type', 'checkbox')
            //.attr('checked', 'checked');
        restriction_probableContainer.append('label')
            .attr('for', 'C2')
            .text('Probable');
        //  END 2st container div

        // ++++++++++++
        // events
        // ++++++++++++


        //d3.select('.toggleEditModeContainer').on('click', function() {
        //    if (d3.select('.layer-telenav').classed('editMode')) {
        //        d3.select('.layer-telenav').classed('editMode', false);
        //    } else {
        //        d3.select('.layer-telenav').classed('editMode', true);
        //    }
        //});

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

        d3.selectAll('#statusFilter input').on('click', function() {
            status = d3.event.currentTarget.id;
            render(d3.select('.layer-telenav'));
        });

        d3.select('#saveComment').on('click', _editPanel.saveComment);

        d3.select('#setSolved').on('click', function() {
            _editPanel.setStatus.call(_editPanel, 'SOLVED');
        });
        d3.select('#setOpen').on('click', function() {
            _editPanel.setStatus.call(_editPanel, 'OPEN');
        });
        d3.select('#setInvalid').on('click', function() {
            _editPanel.setStatus.call(_editPanel, 'INVALID');
        });

    }();

    return render;
};

