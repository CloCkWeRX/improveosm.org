iD.TelenavLayer = function (context) {
    var enable = false,
        svg,
        request;

    function transformLinePoints(item) {

        var stringPoints = [];
        for (var i = 0; i < item.points.length; i++) {
            var point = context.projection([item.points[i].lon, item.points[i].lat]);
            stringPoints.push(point.toString());
        }

        return stringPoints.join(' ');
    }

    function guid() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
        }
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
            s4() + '-' + s4() + s4() + s4();
    }

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

        var turnRestrictionPolylines = svg.selectAll('.telenavDrawing > polyline');
        turnRestrictionPolylines.attr('points', transformLinePoints);

        var extent = context.map().extent();

        if (request)
            request.abort();

        var zoom = Math.round(context.map().zoom());

        if (zoom > 14) {
            request = d3.json('http://fcd-ss.skobbler.net:2680/directionOfFlowService_test/search?south=' +
                extent[0][1] + '&north=' + extent[1][1] + '&west=' +
                extent[0][0] + '&east=' + extent[1][0] + '&zoom=' + zoom,
                function (error, data) {
                    if (error || typeof data.roadSegments == 'undefined') {
                        svg.selectAll('g')
                            .remove();
                        return;
                    }

                    var items = [];

                    for (var i = 0; i < data.roadSegments.length; i++) {
                        data.roadSegments[i].id = guid();
                        items.push(data.roadSegments[i]);
                    }

                    var g = svg.selectAll('g')
                        .data(items, function(d) {
                            return d.id;
                        });

                    var enter = g.enter().append('g')
                        .attr('class', 'telenavDrawing');

                    var firstPoly = enter.append('polyline');
                    firstPoly.attr('points', transformLinePoints);

                    g.exit()
                        .remove();
                }
            );
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

