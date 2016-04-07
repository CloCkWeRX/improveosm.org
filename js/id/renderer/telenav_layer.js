iD.TelenavLayer = function (context) {
    var enable = false,
        svg,
        requestQueue = [],
        combinedItems = [],
        selectedItems = [],
        requestCount;

    var types = {
        dof: 'http://fcd-ss.skobbler.net:2680/directionOfFlowService_test/search',
        mr: 'http://fcd-ss.skobbler.net:2680/missingGeoService_test/search',
        tr: 'http://fcd-ss.skobbler.net:2680/turnRestrictionService_test/search'
    };

    var selectedTypes = [];

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

        var zoom = Math.round(context.map().zoom());

        if (zoom > 14) {
            d3.select("#sidebar").classed('telenavPaneActive', enable);
            d3.select(".pane-telenav").classed('hidden', !enable);
        } else {
            d3.select("#sidebar").classed('telenavPaneActive', false);
            d3.select(".pane-telenav").classed('hidden', true);
        }

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

        var boundingBoxUrlFragments = '?south=' +
            extent[0][1] + '&north=' + extent[1][1] + '&west=' +
            extent[0][0] + '&east=' + extent[1][0] + '&zoom=' + zoom;

        var requestUrlQueue = [];
        for (var i = 0; i < selectedTypes.length; i++) {
            requestUrlQueue.push(types[selectedTypes[i]] + boundingBoxUrlFragments);
        }

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

    var buildPane = function() {

        var div = d3.selectAll('.pane_telenav')
            .data([0]);

        var enter = div.enter().append('div')
            .attr('class', 'pane-telenav hidden');

        var toggleEditModeContainer = enter.append('div')
            .attr('class', 'toggleEditModeContainer');

        toggleEditModeContainer.append('input')
            .attr('type', 'checkbox')
            .attr('id', 'toggleEditMode')
            .attr('class', 'tel_displayBlock');
        toggleEditModeContainer.append('label')
            .attr('for', 'toggleEditMode')
            .text('Toggle Edit Mode');

        var $statusContainer = enter.append('div')
            .attr('id', 'STATUS')
            .attr('class', 'tel_displayBlock')
            .text('Reported Status');

        var $statusForm = $statusContainer.append('form')
            .attr('class', 'filterForm');

        var $statusDivOpen = $statusForm.append('div')
            .attr('class', 'tel_displayInline');
        var $statusLabelOpen = $statusDivOpen.append('label')
            .attr('for', 'OPEN')
            .text('open');

        var statusInputOpen = $statusDivOpen.append('input')
            .attr('type', 'radio')
            .attr('id', 'OPEN')
            .attr('class', 'filterItem')
            .attr('name', 'filter');
        var $statusDivSolved = $statusForm.append('div')
            .attr('class', 'tel_displayInline');
        var $statusLabelSolved = $statusDivSolved.append('label')
            .attr('for', 'SOLVED')
            .text('solved');

        var statusInputSolved = $statusLabelSolved.append('input')
            .attr('type', 'radio')
            .attr('id', 'SOLVED')
            .attr('class', 'filterItem')
            .attr('name', 'filter');

        var $statusDivInvalid = $statusForm.append('div')
            .attr('class', 'tel_displayInline');
        var $statusLabelInvalid = $statusDivInvalid.append('label')
            .attr('for', 'INVALID')
            .text('invalid');

        var statusInputInvalid = $statusDivInvalid.append('input')
            .attr('type', 'radio')
            .attr('id', 'INVALID')
            .attr('class', 'filterItem')
            .attr('name', 'filter');



        var $directionFilterContainer = enter.append('div')
            .attr('id', 'DIRECTION_FILTER')
            .attr('class', 'tel_displayBlock');

        $directionFilterContainer.append('input')
            .attr('type', 'checkbox')
            .attr('class', 'filterActivation')
            .attr('id', 'oneWayConfidence');

        var $directionFilterLabel = $directionFilterContainer.append('label')
            .attr('class', 'sectionHeader')
            .attr('for', 'oneWayConfidence')
            .text('One-way confidence');

        var $directionFilterForm = $directionFilterContainer.append('form')
            .attr('class', 'typeForm');
        var $direction_highlyProbableContainer = $directionFilterForm.append('div')
            .attr('class', 'tel_displayInline');
        $direction_highlyProbableContainer.append('input')
            .attr('id', 'C1')
            .attr('type', 'checkbox');
        $direction_highlyProbableContainer.append('label')
            .attr('for', 'C1')
            .text('Highly Probable');
        var $direction_mostLikelyContainer = $directionFilterForm.append('div')
            .attr('class', 'tel_displayInline');
        $direction_mostLikelyContainer.append('input')
            .attr('id', 'C2')
            .attr('type', 'checkbox');
        $direction_mostLikelyContainer.append('label')
            .attr('for', 'C2')
            .text('Most Likely');
        var $direction_probableContainer = $directionFilterForm.append('div')
            .attr('class', 'tel_displayInline');
        $direction_probableContainer.append('input')
            .attr('id', 'C3')
            .attr('type', 'checkbox');
        $direction_probableContainer.append('label')
            .attr('for', 'C3')
            .text('Probable');


        var $missingFilterContainer = enter.append('div')
            .attr('id', 'MISSING_FILTER')
            .attr('class', 'tel_displayBlock');

        $missingFilterContainer                    .append('input')
            .attr('type', 'checkbox')
            .attr('class', 'filterActivation')
            .attr('id', 'missingRoadType');

        var $missingFilterLabel = $missingFilterContainer.append('label')
            .attr('class', 'sectionHeader')
            .attr('for', 'missingRoadType')
            .text('Missing road type');

        var $missingFilterForm = $missingFilterContainer.append('form')
            .attr('class', 'typeForm');
        var $missing_roadContainer = $missingFilterForm.append('div')
            .attr('class', 'tel_displayInline');
        $missing_roadContainer.append('input')
            .attr('id', 'ROAD')
            .attr('type', 'checkbox');
        $missing_roadContainer.append('label')
            .attr('for', 'ROAD')
            .text('Road');
        var $missing_parkingContainer = $missingFilterForm.append('div')
            .attr('class', 'tel_displayInline');
        $missing_parkingContainer.append('input')
            .attr('id', 'PARKING')
            .attr('type', 'checkbox');
        $missing_parkingContainer.append('label')
            .attr('for', 'PARKING')
            .text('Parking');
        var $missing_bothContainerContainer = $missingFilterForm.append('div')
            .attr('class', 'tel_displayInline');
        $missing_bothContainerContainer.append('input')
            .attr('id', 'BOTH')
            .attr('type', 'checkbox');
        $missing_bothContainerContainer.append('label')
            .attr('for', 'BOTH')
            .text('Both');

        $missingFilterForm.append('p')
            .attr('class', 'sectionHeader tel_displayBlock')
            .text('Filters');

        var $missing_waterContainer = $missingFilterForm.append('div')
            .attr('class', 'tel_displayInline');
        $missing_waterContainer.append('input')
            .attr('id', 'WATER')
            .attr('type', 'checkbox');
        $missing_waterContainer.append('label')
            .attr('for', 'WATER')
            .text('Water Trail');

        var $missing_pathContainer = $missingFilterForm.append('div')
            .attr('class', 'tel_displayInline');
        $missing_pathContainer.append('input')
            .attr('id', 'PATH')
            .attr('type', 'checkbox');
        $missing_pathContainer.append('label')
            .attr('for', 'PATH')
            .text('Path Trail');


        var $restrictionFilterContainer = enter.append('div')
            .attr('id', 'RESTRICTION_FILTER')
            .attr('class', 'tel_displayBlock');

        $restrictionFilterContainer                    .append('input')
            .attr('type', 'checkbox')
            .attr('class', 'filterActivation')
            .attr('id', 'turnRestrictionConfidence');

        var $restrictionFilterLabel = $restrictionFilterContainer.append('label')
            .attr('class', 'sectionHeader')
            .attr('for', 'turnRestrictionConfidence')
            .text('Turn Restriction confidence');

        var $restrictionFilterForm = $restrictionFilterContainer.append('form')
            .attr('class', 'typeForm');

        var $restriction_highlyProbableContainer = $restrictionFilterForm.append('div')
            .attr('class', 'tel_displayInline');
        $restriction_highlyProbableContainer.append('input')
            .attr('id', 'C1')
            .attr('type', 'checkbox');
        $restriction_highlyProbableContainer.append('label')
            .attr('for', 'C1')
            .text('Highly Probable');

        var $restriction_probableContainer = $restrictionFilterForm.append('div')
            .attr('class', 'tel_displayInline');
        $restriction_probableContainer.append('input')
            .attr('id', 'C2')
            .attr('type', 'checkbox');
        $restriction_probableContainer.append('label')
            .attr('for', 'C2')
            .text('Probable');

        d3.select('.toggleEditModeContainer').on('click', function() {
            if (d3.select('.layer-telenav').classed('editMode')) {
                d3.select('.layer-telenav').classed('editMode', false);
            } else {
                d3.select('.layer-telenav').classed('editMode', true);
            }
        });

        d3.select('#oneWayConfidence').on('click', function() {
            if (d3.select('#oneWayConfidence').property('checked')) {
                selectedTypes.push('dof');
            } else {
                selectedTypes.splice(selectedTypes.indexOf('dof'), 1);
            }
            render(d3.select('.layer-telenav'));
        });

        d3.select('#missingRoadType').on('click', function() {
            if (d3.select('#missingRoadType').property('checked')) {
                selectedTypes.push('mr');
            } else {
                selectedTypes.splice(selectedTypes.indexOf('mr'), 1);
            }
            render(d3.select('.layer-telenav'));
        });

        d3.select('#turnRestrictionConfidence').on('click', function() {
            if (d3.select('#turnRestrictionConfidence').property('checked')) {
                selectedTypes.push('tr');
            } else {
                selectedTypes.splice(selectedTypes.indexOf('tr'), 1);
            }
            render(d3.select('.layer-telenav'));
        });

    }();

    return render;
};

