iD.TelenavLayerTR = function (context) {
    var enable = false,
        svg,
        request;

    function transformX(item) {
        return Math.floor(context.projection([item.point.lon, item.point.lat])[0]);
    }

    function transformY(item) {
        return Math.floor(context.projection([item.point.lon, item.point.lat])[1]);
    }

    function transformLinePoints(item) {

        var stringPoints = [];
        for (var i = 0; i < item.segments.length; i++) {
            for (var j = 0; j < item.segments[i].points.length; j++) {
                var point = context.projection([item.segments[i].points[j].lon, item.segments[i].points[j].lat]);
                stringPoints.push(point.toString());
            }
        }

        return stringPoints.join(' ');
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

        var turnRestrictionCircles = svg.selectAll('.turnRestriction > circle');
        turnRestrictionCircles.attr('cx', transformX);
        turnRestrictionCircles.attr('cy', transformY);

        var turnRestrictionPolylines = svg.selectAll('.turnRestriction > polyline');
        turnRestrictionPolylines.attr('points', transformLinePoints);

        var extent = context.map().extent();

        if (request)
            request.abort();

        var zoom = Math.round(context.map().zoom());

        if (zoom > 14) {
            request = d3.json('http://fcd-ss.skobbler.net:2680/turnRestrictionService_test/search?south=' +
                extent[0][1] + '&north=' + extent[1][1] + '&west=' +
                extent[0][0] + '&east=' + extent[1][0] + '&zoom=' + zoom,
                function (error, data) {
                    if (error || typeof data.entities == 'undefined') {
                        svg.selectAll('g')
                            .remove();
                        return;
                    }

                    var items = [];

                    for (var i = 0; i < data.entities.length; i++) {
                        items.push(data.entities[i]);
                    }

                    var g = svg.selectAll('g')
                        .data(items, function(d) {
                            return d.id;
                        });

                    var enter = g.enter().append('g')
                        .attr('class', 'turnRestriction');

                    var firstPoly = enter.append('polyline');
                    firstPoly.attr('points', transformLinePoints);

                    var selectedCircle = enter.append('circle');
                    selectedCircle.attr('cx', transformX);
                    selectedCircle.attr('cy', transformY);
                    selectedCircle.attr('r', '10');


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

