iD.TelenavLayerMR = function (context) {
    var enable = false,
        svg,
        request;

    function transformX(item) {
        return Math.floor(context.projection([item.lon, item.lat])[0]);
    }

    function transformY(item) {
        return Math.floor(context.projection([item.lon, item.lat])[1]);
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

        var turnRestrictionCircles = svg.selectAll('.missingRoads > circle');
        turnRestrictionCircles.attr('cx', transformX);
        turnRestrictionCircles.attr('cy', transformY);

        var extent = context.map().extent();

        if (request)
            request.abort();

        var zoom = Math.round(context.map().zoom());

        if (zoom > 14) {
            request = d3.json('http://fcd-ss.skobbler.net:2680/missingGeoService_test/search?south=' +
                extent[0][1] + '&north=' + extent[1][1] + '&west=' +
                extent[0][0] + '&east=' + extent[1][0] + '&zoom=' + zoom,
                function (error, data) {
                    if (error || typeof data.tiles == 'undefined') {
                        svg.selectAll('g')
                            .remove();
                        return;
                    }

                    var items = [];

                    for (var i = 0; i < data.tiles.length; i++) {
                        for (var j= 0; j < data.tiles[i].points.length; j++) {
                            items.push({
                                lat: data.tiles[i].points[j].lat,
                                lon: data.tiles[i].points[j].lon,
                                id: guid()
                            });
                        }
                    }

                    var g = svg.selectAll('g')
                        .data(items, function(d) {
                            return d.id;
                        });

                    var enter = g.enter().append('g')
                        .attr('class', 'missingRoads');

                    var selectedCircle = enter.append('circle');
                    selectedCircle.attr('cx', transformX);
                    selectedCircle.attr('cy', transformY);
                    selectedCircle.attr('r', '2');


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

