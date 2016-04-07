iD.TelenavLayer = function (context) {
    var enable = false,
        svg,
        requestQueue = [],
        combinedItems = [],
        selectedItems = [],
        requestCount;

    // ==============================
    // ==============================
    // MapItem
    // ==============================
    // ==============================
    var MapItem = function() {
        // ---
        this._className = 'MapItem';
        this._id = null;

        this.isA = function(proposedClassName) {
            return proposedClassName === this._className;
        };
        this.getId = function() {
            return this._id;
        };
        this.getClass = function() {
            return this._className;
        };
    };
    MapItem.transformClass = function(item) {
        return item.getClass();
    };
    MapItem.transformId = function(item) {
        return item.getId();
    };
    MapItem.handleSelection = function(item) {
        var node = d3.select('#' + item.getId());
        if (node.classed('selected')) {
            if (d3.event.ctrlKey) {
                node.classed('selected', false);
                for (var i = 0; i < selectedItems.length; i++) {
                    if (selectedItems[i].getId() === item.getId()) {
                        selectedItems.splice(i, 1);
                    }
                }
            } else {
                if (svg.selectAll('g.selected')[0].length === 1) {
                    node.classed('selected', false);
                    selectedItems.length = 0;
                } else {
                    svg.selectAll('g').classed('selected', false);
                    selectedItems.length = 0;
                    node.classed('selected', true);
                    selectedItems.push(item);
                }
            }
        } else {
            if (d3.event.ctrlKey) {
                node.classed('selected', true);
                selectedItems.push(item);
            } else {
                svg.selectAll('g').classed('selected', false);
                selectedItems.length = 0;
                node.classed('selected', true);
                selectedItems.push(item);
            }
        }
        d3.event.stopPropagation();
    };
    // ==============================
    // ==============================
    // TurnRestrictionItem
    // ==============================
    // ==============================
    var TurnRestrictionItem = function(rawItemData) {
        // ---
        this._className = 'TurnRestrictionItem';
        this._id = 'tr_' + rawItemData.id.replace(/\:/g,'_').replace(/\+/g,'_').replace(/\#/g,'_');

        this.getPoint = function() {
            return rawItemData.point;
        };
        this.getSegments = function() {
            return rawItemData.segments;
        };
    };
    // static
    TurnRestrictionItem.prototype = new MapItem();
    TurnRestrictionItem.transformX = function(item) {
        return Math.floor(context.projection([item.getPoint().lon, item.getPoint().lat])[0]);
    };
    TurnRestrictionItem.transformY= function(item) {
        return Math.floor(context.projection([item.getPoint().lon, item.getPoint().lat])[1]);
    };
    TurnRestrictionItem.transformLinePoints = function(item) {
        var stringPoints = [];
        for (var i = 0; i < item.getSegments().length; i++) {
            for (var j = 0; j < item.getSegments()[i].points.length; j++) {
                var point = context.projection([item.getSegments()[i].points[j].lon, item.getSegments()[i].points[j].lat]);
                stringPoints.push(point.toString());
            }
        }

        return stringPoints.join(' ');
    };
    // ==============================
    // ==============================
    // MissingRoadIcon
    // ==============================
    // ==============================
    var MissingRoadItem = function(rawItemData) {
        this._className = 'MissingRoadItem';
        this._id = ('mr_' + rawItemData.lat + '_' + rawItemData.lon).replace(/\./g,'_');
        this.getLat = function() {
            return rawItemData.lat;
        };
        this.getLon = function() {
            return rawItemData.lon;
        };
    };
    MissingRoadItem.prototype = new MapItem();
    MissingRoadItem.transformX = function(item) {
        return Math.floor(context.projection([item.getLon(), item.getLat()])[0]);
    };
    MissingRoadItem.transformY = function(item) {
        return Math.floor(context.projection([item.getLon(), item.getLat()])[1]);
    };
    // ==============================
    // ==============================
    // DirectionOfFlowItem
    // ==============================
    // ==============================
    var DirectionOfFlowItem = function(rawItemData) {
        this._className = 'DirectionOfFlowItem';
        this._id = 'dof_' + [rawItemData.fromNodeId, rawItemData.toNodeId, rawItemData.wayId].join('_');
        this.getPoints = function() {
            return rawItemData.points;
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
    // SelectionHandler
    // ==============================
    // ==============================
    var SelectionHandler = function() {

    };

    var _synchCallbacks = function(error, data) {

        if (data.hasOwnProperty('roadSegments')) {
            for (var i = 0; i < data.roadSegments.length; i++) {
                combinedItems.push(new DirectionOfFlowItem(
                    data.roadSegments[i]
                ));
            }
        }
        if (data.hasOwnProperty('tiles')) {
            for (var i = 0; i < data.tiles.length; i++) {
                for (var j= 0; j < data.tiles[i].points.length; j++) {
                    combinedItems.push(new MissingRoadItem(
                        data.tiles[i].points[j]
                    ));
                }
            }
        }
        if (data.hasOwnProperty('entities')) {
            for (var i = 0; i < data.entities.length; i++) {
                combinedItems.push(new TurnRestrictionItem(
                    data.entities[i]
                ));
            }
        }



        if (!--requestCount) {
            if (error) {
                svg.selectAll('g')
                    .remove();
                return;
            }
            var g = svg.selectAll('g')
                .data(combinedItems, function(item) {
                    return item.getId();
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

            var dofPoly = dOFs.append('polyline');
            dofPoly.attr('points', DirectionOfFlowItem.transformLinePoints);

            var mrCircle = mRs.append('circle');
            mrCircle.attr('cx', MissingRoadItem.transformX);
            mrCircle.attr('cy', MissingRoadItem.transformY);
            mrCircle.attr('r', '2');

            var trPoly = tRs.append('polyline');
            trPoly.attr('points', TurnRestrictionItem.transformLinePoints);
            var trCircle = tRs.append('circle');
            trCircle.attr('cx', TurnRestrictionItem.transformX);
            trCircle.attr('cy', TurnRestrictionItem.transformY);
            trCircle.attr('r', '10');

            dOFs.on('click', MapItem.handleSelection);
            mRs.on('click', MapItem.handleSelection);
            tRs.on('click', MapItem.handleSelection);


            g.exit()
                .remove();
        }

    };

    function render(selection) {
        svg = selection.selectAll('svg')
            .data([0]);

        svg.enter().append('svg');

        svg.style('display', enable ? 'block' : 'none');


        if (!enable) {

            svg.selectAll('g')
                .remove();

            return;
        }

        var directionOfFlowPolylines = svg.selectAll('.DirectionOfFlowItem > polyline');
        directionOfFlowPolylines.attr('points', DirectionOfFlowItem.transformLinePoints);

        var missingRoadsCircles = svg.selectAll('.MissingRoadItem > circle');
        missingRoadsCircles.attr('cx', MissingRoadItem.transformX);
        missingRoadsCircles.attr('cy', MissingRoadItem.transformY);

        var turnRestrictionCircles = svg.selectAll('.TurnRestrictionItem > circle');
        turnRestrictionCircles.attr('cx', TurnRestrictionItem.transformX);
        turnRestrictionCircles.attr('cy', TurnRestrictionItem.transformY);

        var turnRestrictionPolylines = svg.selectAll('.TurnRestrictionItem > polyline');
        turnRestrictionPolylines.attr('points', TurnRestrictionItem.transformLinePoints);

        var extent = context.map().extent();

        if (requestQueue.length > 0) {
            for (var i = 0; i < requestQueue.length; i++) {
                requestQueue[i].abort();
            }
            requestQueue.length = 0;
        }

        var zoom = Math.round(context.map().zoom());

        var boundingBoxUrlFragments = '?south=' +
            extent[0][1] + '&north=' + extent[1][1] + '&west=' +
            extent[0][0] + '&east=' + extent[1][0] + '&zoom=' + zoom;

        var requestUrlQueue = [];
        requestUrlQueue.push('http://fcd-ss.skobbler.net:2680/directionOfFlowService_test/search' + boundingBoxUrlFragments);
        requestUrlQueue.push('http://fcd-ss.skobbler.net:2680/missingGeoService_test/search' + boundingBoxUrlFragments);
        requestUrlQueue.push('http://fcd-ss.skobbler.net:2680/turnRestrictionService_test/search' + boundingBoxUrlFragments);

        requestCount = requestUrlQueue.length;
        combinedItems.length = 0;

        if (zoom > 14) {
            for (var i = 0; i < requestUrlQueue.length; i++) {
                requestQueue[i] = d3.json(requestUrlQueue[i], _synchCallbacks);
            }
        } else {
            svg.selectAll('g')
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

    return render;
};

