iD.TelenavLayer = function (context) {
    var enable = false,
        svg,
        requestQueue = [],
        _combinedData = [],
        requestCount;

    function transformDofLinePoints(item) {

        var stringPoints = [];
        for (var i = 0; i < item.points.length; i++) {
            var point = context.projection([item.points[i].lon, item.points[i].lat]);
            stringPoints.push(point.toString());
        }

        return stringPoints.join(' ');
    }

    function transformXtr(item) {
        return Math.floor(context.projection([item.point.lon, item.point.lat])[0]);
    }

    function transformYtr(item) {
        return Math.floor(context.projection([item.point.lon, item.point.lat])[1]);
    }

    function transformXmr(item) {
        return Math.floor(context.projection([item.lon, item.lat])[0]);
    }

    function transformYmr(item) {
        return Math.floor(context.projection([item.lon, item.lat])[1]);
    }

    function transformTrLinePoints(item) {

        var stringPoints = [];
        for (var i = 0; i < item.segments.length; i++) {
            for (var j = 0; j < item.segments[i].points.length; j++) {
                var point = context.projection([item.segments[i].points[j].lon, item.segments[i].points[j].lat]);
                stringPoints.push(point.toString());
            }
        }

        return stringPoints.join(' ');
    }

    var _transformType = function(item) {
        return item.class;
    };

    var _synchCallbacks = function(error, data) {

        if (data.hasOwnProperty('roadSegments')) {
            for (var i = 0; i < data.roadSegments.length; i++) {
                var item = data.roadSegments[i];
                item.id = [item.fromNodeId, item.toNodeId, item.wayId].join('+');
                item.class = 'directionOfFlow';
                _combinedData.push(item);
            }
        }
        if (data.hasOwnProperty('tiles')) {
            for (var i = 0; i < data.tiles.length; i++) {
                for (var j= 0; j < data.tiles[i].points.length; j++) {
                    _combinedData.push({
                        lat: data.tiles[i].points[j].lat,
                        lon: data.tiles[i].points[j].lon,
                        id: data.tiles[i].points[j].lat + ':' + data.tiles[i].points[j].lon,
                        class: 'missingRoads'
                    });
                }
            }
        }
        if (data.hasOwnProperty('entities')) {
            for (var i = 0; i < data.entities.length; i++) {
                data.entities[i].class = 'turnRestriction'
                _combinedData.push(data.entities[i]);
            }
        }



        if (!--requestCount) {
            if (error) {
                svg.selectAll('g')
                    .remove();
                return;
            }
            var g = svg.selectAll('g')
                .data(_combinedData, function(d) {
                    return d.id;
                });
            var enter = g.enter().append('g')
                .attr('class', _transformType);

            var dOFs = enter.filter(function(item) {
                return item.class === 'directionOfFlow';
            });
            var mRs = enter.filter(function(item) {
                return item.class === 'missingRoads';
            });
            var tRs = enter.filter(function(item) {
                return item.class === 'turnRestriction';
            });

            var dofPoly = dOFs.append('polyline');
            dofPoly.attr('points', transformDofLinePoints);

            var mrCircle = mRs.append('circle');
            mrCircle.attr('cx', transformXmr);
            mrCircle.attr('cy', transformYmr);
            mrCircle.attr('r', '2');

            var trPoly = tRs.append('polyline');
            trPoly.attr('points', transformTrLinePoints);
            var trCircle = tRs.append('circle');
            trCircle.attr('cx', transformXtr);
            trCircle.attr('cy', transformYtr);
            trCircle.attr('r', '10');

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

        var directionOfFlowPolylines = svg.selectAll('.directionOfFlow > polyline');
        directionOfFlowPolylines.attr('points', transformDofLinePoints);

        var missingRoadsCircles = svg.selectAll('.missingRoads > circle');
        missingRoadsCircles.attr('cx', transformXmr);
        missingRoadsCircles.attr('cy', transformYmr);

        var turnRestrictionCircles = svg.selectAll('.turnRestriction > circle');
        turnRestrictionCircles.attr('cx', transformXtr);
        turnRestrictionCircles.attr('cy', transformYtr);

        var turnRestrictionPolylines = svg.selectAll('.turnRestriction > polyline');
        turnRestrictionPolylines.attr('points', transformTrLinePoints);

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

