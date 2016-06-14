iD.TelenavLayer = function (context) {
    var enable = false,
        svg,
        requestQueue = [],
        combinedItems = [],
        selectedItems = [],
        status = 'OPEN',
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

    var getTileSquare = function(x, y) {
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
    }

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
                node.classed('selected', true)
                .attr('marker-end', 'url(#telenav-selected-arrow-marker)');
                selectedItems.push(item);
            } else {
                svg.selectAll('g').classed('selected', false);
                selectedItems.length = 0;
                node.classed('selected', true);
                selectedItems.push(item);
            }
        }
        d3.event.stopPropagation();
        if (selectedItems.length === 0) {
            _editPanel.goToMain();
        } else {
            _editPanel.goToEdit();
        }
    };
    MapItem.handleMouseOver = function(item) {
        var nodes = d3.selectAll('#' + item.getId() + ' .highlight')
            .classed('highlightOn', true)
            .classed('highlightOff', false)
            .attr('marker-end', 'url(#telenav-selected-arrow-marker)')
            .attr('marker-start', 'url(#telenav-selected-arrow-marker)');
    };
    MapItem.handleMouseOut = function(item) {
        var nodes = d3.selectAll('#' + item.getId() + ' .highlight')
            .classed('highlightOn', false)
            .classed('highlightOff', true)
            .attr('marker-end', null)
            .attr('marker-start', null);
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
                val: rawItemData.segments[1].numberOfTrips,
                x: Math.floor(context.projection([x, y])[0]),
                y: Math.floor(context.projection([x, y])[1])
            }
        }
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
    TurnRestrictionItem.transformLinePointsOut = function(item) {
        var stringPoints = [];
            for (var j = 0; j < item.getSegments()[1].points.length; j++) {
                var point = context.projection([item.getSegments()[1].points[j].lon, item.getSegments()[1].points[j].lat]);
                stringPoints.push(point.toString());
            }

        return stringPoints.join(' ');
    };
    TurnRestrictionItem.transformLinePointsIn = function(item) {
        var stringPoints = [];
            for (var j = 0; j < item.getSegments()[0].points.length; j++) {
                var point = context.projection([item.getSegments()[0].points[j].lon, item.getSegments()[0].points[j].lat]);
                stringPoints.push(point.toString());
            }

        return stringPoints.join(' ');
    };
    TurnRestrictionItem.transformInNoX = function(item) {
        return item.getInNo().x - 10;
    };
    TurnRestrictionItem.transformInNoY = function(item) {
        return item.getInNo().y - 10;
    };
    TurnRestrictionItem.transformInNo = function(item) {
        return item.getInNo().val;
    };
    TurnRestrictionItem.transformOutNoX = function(item) {
        return item.getOutNo().x - 10;
    };
    TurnRestrictionItem.transformOutNoY = function(item) {
        return item.getOutNo().y - 10;
    };
    TurnRestrictionItem.transformOutNo = function(item) {
        return item.getOutNo().val;
    };

    TurnRestrictionItem.transformInNoRectX = function(item) {
        return item.getInNo().x - 10;
    };
    TurnRestrictionItem.transformInNoRectY = function(item) {
        return item.getInNo().y - 19;
    };
    TurnRestrictionItem.transformOutNoRectX = function(item) {
        return item.getOutNo().x - 10;
    };
    TurnRestrictionItem.transformOutNoRectY = function(item) {
        return item.getOutNo().y - 19;
    };
    TurnRestrictionItem.transformInNoRectWidth = function(item) {
        return item.getInNo().val.toString().length * 6;
    };
    TurnRestrictionItem.transformOutNoRectWidth = function(item) {
        return item.getOutNo().val.toString().length * 6;
    };
    // ==============================
    // ==============================
    // MissingRoadIcon
    // ==============================
    // ==============================
    var MissingRoadItem = function(rawItemData) {
        this._className = 'MissingRoadItem';
        this._id = ('mr_' + rawItemData.x + '_' + rawItemData.y).replace(/\./g,'_');
        this._points = rawItemData.points;
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
        }
    };
    MissingRoadItem.prototype = new MapItem();
    MissingRoadItem.computeX = function(lat, lon) {
        return Math.floor(context.projection([lon, lat])[0]);
    };
    MissingRoadItem.computeY = function(lat, lon) {
        return Math.floor(context.projection([lon, lat])[1]);
    };
    MissingRoadItem.transformTileX = function(item) {
        var squareCoords = getTileSquare(item.getX(), item.getY());
        var startLat = squareCoords.latMax;
        var startLon = squareCoords.lonMin;
        return Math.floor(context.projection([startLon, startLat])[0]);
    };
    MissingRoadItem.transformTileY = function(item) {
        var squareCoords = getTileSquare(item.getX(), item.getY());
        var startLat = squareCoords.latMax;
        var startLon = squareCoords.lonMin;
        return Math.floor(context.projection([startLon, startLat])[1]);
    };
    MissingRoadItem.transformTileWidth = function(item) {
        var squareCoords = getTileSquare(item.getX(), item.getY());
        var startLat = squareCoords.latMax;
        var startLon = squareCoords.lonMin;
        var startX = Math.floor(context.projection([startLon, startLat])[0]);
        var endLat = squareCoords.latMin;
        var endLon = squareCoords.lonMax;
        var endX = Math.floor(context.projection([endLon, endLat])[0]);
        return Math.abs(endX - startX);
    };
    MissingRoadItem.transformTileHeight = function(item) {
        var squareCoords = getTileSquare(item.getX(), item.getY());
        var startLat = squareCoords.latMax;
        var startLon = squareCoords.lonMin;
        var startY = Math.floor(context.projection([startLon, startLat])[1]);
        var endLat = squareCoords.latMin;
        var endLon = squareCoords.lonMax;
        var endY = Math.floor(context.projection([endLon, endLat])[1]);
        return Math.abs(endY - startY);
    };

    MissingRoadItem.computeTileX = function(x, y) {
        var squareCoords = getTileSquare(x, y);
        var startLat = squareCoords.latMax;
        var startLon = squareCoords.lonMin;
        return Math.floor(context.projection([startLon, startLat])[0]);
    };
    MissingRoadItem.computeTileY = function(x, y) {
        var squareCoords = getTileSquare(x, y);
        var startLat = squareCoords.latMax;
        var startLon = squareCoords.lonMin;
        return Math.floor(context.projection([startLon, startLat])[1]);
    };
    MissingRoadItem.computeTileWidth = function(x, y) {
        var squareCoords = getTileSquare(x, y);
        var startLat = squareCoords.latMax;
        var startLon = squareCoords.lonMin;
        var startX = Math.floor(context.projection([startLon, startLat])[0]);
        var endLat = squareCoords.latMin;
        var endLon = squareCoords.lonMax;
        var endX = Math.floor(context.projection([endLon, endLat])[0]);
        return Math.abs(endX - startX);
    };
    MissingRoadItem.computeTileHeight = function(x, y) {
        var squareCoords = getTileSquare(x, y);
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
        this._className = 'DirectionOfFlowItem';
        this._id = 'dof_' + [rawItemData.fromNodeId, rawItemData.toNodeId, rawItemData.wayId].join('_');
        this.getPoints = function() {
            return rawItemData.points;
        };
        this.getIdentifier = function() {
            return [{
                wayId: rawItemData.wayId,
                fromNodeId: rawItemData.fromNodeId,
                toNodeId: rawItemData.toNodeId
            }];
        }
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
    // EditPanel
    // ==============================
    // ==============================
    var EditPanel = function() {

        this._location = 'MAIN';

        //get the width of the panel for animation effect
        this._panelWidth = function(){
            return parseInt(d3.select('.telenav-wrap').style('width'));
        }

        this.getLocation = function() {
            return this._location;
        };

        this.show = function() {

        };

        this.renderMessage = function() {

        };

        this.deselectAll = function() {
            svg.selectAll('g').classed('selected', false);
            selectedItems.length = 0;
            this.goToMain();
        };

        this.goToMain = function() {
            d3.select('.telenavwrap')
                .transition()
                .style('transform', 'translate3d(0px, 0px,  0px)');
            this._location = 'MAIN';
        };

        this.goToEdit = function() {
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

        this.setStatus = function(status) {

            var This = this;

            context.connection().userDetails(function(err, user) {
                if (err) {
                    context.connection().authenticate(function(err) {
                        if (err) {
                            alert('Error');
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
                for (var i = 0; i < selectedItems.length; i++) {
                    var currentItem = selectedItems[i];

                    var dataToPost = {
                        username: user.display_name,
                        text: 'status changed',
                        status: status
                    };

                    var responseHandler = function(err, rawData) {
                        var data = JSON.parse(rawData.response);
                        console.log("got response", data);
                    };

                    switch (currentItem.getClass()) {
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

            context.connection().userDetails(function(err, user) {
                if (err) {
                    context.connection().authenticate(function(err) {
                        if (err) {
                            alert('Error');
                        } else {
                            This.saveComment();
                        }
                    });
                    return;
                }
                var comment = d3.select('#commentText').property('value');

                for (var i = 0; i < selectedItems.length; i++) {
                    var currentItem = selectedItems[i];

                    var dataToPost = {
                        username: 'Tudor009',
                        text: comment
                    };

                    var responseHandler = function (err, rawData) {
                        var data = JSON.parse(rawData.response);
                        console.log("got response", data);
                    };

                    switch (currentItem.getClass()) {
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
                combinedItems.push(new MissingRoadItem(
                    data.tiles[i]
                ));
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
            dofPoly.attr('marker-end', 'url(#telenav-arrow-marker)');
            var dofSelPoly = dOFs.append('polyline').attr('class', 'highlight');
            dofSelPoly.attr('points', DirectionOfFlowItem.transformLinePoints);

            mRs.html(function(d) {
                var html = '';
                for (var i = 0; i < d._points.length; i++) {
                    var cx = MissingRoadItem.computeX(d._points[i].lat, d._points[i].lon);
                    var cy = MissingRoadItem.computeY(d._points[i].lat, d._points[i].lon);
                    html += '<circle cx=' + cx + ' cy=' + cy + ' r=2></circle>';
                }
                return html;
            });

            var mrRect = mRs.append('rect');
            mrRect.attr('x', MissingRoadItem.transformTileX);
            mrRect.attr('y', MissingRoadItem.transformTileY);
            mrRect.attr('width', MissingRoadItem.transformTileWidth);
            mrRect.attr('height', MissingRoadItem.transformTileHeight);
            mrRect.attr('fill', '#044B94');
            mrRect.attr('fill-opacity', '0.4');

            var mrSelRect = mRs.append('rect');
            mrSelRect.attr('class', 'highlight')
            mrSelRect.attr('x', MissingRoadItem.transformTileX);
            mrSelRect.attr('y', MissingRoadItem.transformTileY);
            mrSelRect.attr('width', MissingRoadItem.transformTileWidth);
            mrSelRect.attr('height', MissingRoadItem.transformTileHeight);
            mrSelRect.attr('fill', '#044B94');
            mrSelRect.attr('fill-opacity', '0.4');

            var trSelPoly = tRs.append('polyline').attr('class', 'highlight highlightOff');
            trSelPoly.attr('points', TurnRestrictionItem.transformLinePoints);
            var trPolyIn = tRs.append('polyline');
            trPolyIn.attr('points', TurnRestrictionItem.transformLinePointsIn);
            trPolyIn.attr('marker-start', 'url(#telenav-arrow-marker-green)');
            trPolyIn.attr('class', 'wayIn');
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
            trPolyOut.attr('marker-end', 'url(#telenav-arrow-marker)');
            trPolyOut.attr('marker-start', 'url(#telenav-tr-marker)');
            trPolyOut.attr('class', 'wayOut');

            dOFs.on('click', MapItem.handleSelection);
            mRs.on('click', MapItem.handleSelection);
            tRs.on('click', MapItem.handleSelection);

            dOFs.on('mouseover', MapItem.handleMouseOver);
            mRs.on('mouseover', MapItem.handleMouseOver);
            tRs.on('mouseover', MapItem.handleMouseOver);

            dOFs.on('mouseout', MapItem.handleMouseOut);
            mRs.on('mouseout', MapItem.handleMouseOut);
            tRs.on('mouseout', MapItem.handleMouseOut);

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

        var missingRoadsCircles = svg.selectAll('.MissingRoadItem');
        missingRoadsCircles.html(function(d) {
            var html = '';
            for (var i = 0; i < d._points.length; i++) {
                var cx = MissingRoadItem.computeX(d._points[i].lat, d._points[i].lon);
                var cy = MissingRoadItem.computeY(d._points[i].lat, d._points[i].lon);
                html += '<circle cx=' + cx + ' cy=' + cy + ' r=2></circle>';
            }
            html += '<rect x=' + MissingRoadItem.computeTileX(d.getX(), d.getY())
                + ' y=' + MissingRoadItem.computeTileY(d.getX(), d.getY())
                + ' width=' + MissingRoadItem.computeTileWidth(d.getX(), d.getY())
                + ' height=' + MissingRoadItem.computeTileHeight(d.getX(), d.getY())
                + ' fill=' + 'red'
                + ' fill-opacity=' + '0.4'
                + '></rect>';
            html += '<rect x=' + MissingRoadItem.computeTileX(d.getX(), d.getY())
                + ' y=' + MissingRoadItem.computeTileY(d.getX(), d.getY())
                + ' width=' + MissingRoadItem.computeTileWidth(d.getX(), d.getY())
                + ' height=' + MissingRoadItem.computeTileHeight(d.getX(), d.getY())
                + ' fill=' + 'red'
                + ' fill-opacity=' + '0.4'
                + ' class="highlight"' + '0.4'
                + '></rect>';
            return html;
        });

        var turnRestrictionPolylinesIn = svg.selectAll('.TurnRestrictionItem > polyline.wayIn');
        turnRestrictionPolylinesIn.attr('points', TurnRestrictionItem.transformLinePointsIn);
        var turnRestrictionPolylinesOut = svg.selectAll('.TurnRestrictionItem > polyline.wayOut');
        turnRestrictionPolylinesOut.attr('points', TurnRestrictionItem.transformLinePointsOut);
        var turnRestrictionPolylinesHighlight = svg.selectAll('.TurnRestrictionItem > polyline.highlight');
        turnRestrictionPolylinesHighlight.attr('points', TurnRestrictionItem.transformLinePoints);

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
            requestUrlQueue.push(types[selectedTypes[i]] + boundingBoxUrlFragments + typesFragments + '&status=' + status);
        }

        requestCount = requestUrlQueue.length;
        combinedItems.length = 0;

        if ((zoom > 14) && (requestUrlQueue.length !== 0)) {
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
        userWindowHeader.append('button')
            .attr('class', 'fr preset-reset')
            .on('click', function() {
                _editPanel.deselectAll();
                render(d3.select('.layer-telenav'));
                //telenavWrap.transition()
                //    .style('transform', 'translate3d(0px, 0px, 0px)');
            })
            .append('span')
            .html('&#9658;');

        userWindowHeader.append('h3')
            .text('Telenav Layers');
        var userWindowBody = userWindow.append('div')
            .attr('class', 'telenav-body');
        var userWindowInner = userWindowBody.append('div')
            .attr('class', 'inspector-border inspector-preset')
            .append('div');
        var userContainer = userWindowInner.append('div')
            .attr('class', 'preset-form inspector-inner fillL3');
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
            .attr('id', 'commentText');

        //  END 3rd container div

        //  START 1st container div
        var generalSettingsWindow = telenavWrap.append('div')
            .attr('id', 'generalSettingsWindow')
            .attr('class', 'entity-editor-pane pane pane-middle');
        var generalWindowsWindowHeader = generalSettingsWindow.append('div')
            .attr('class', 'header fillL cf');
        generalWindowsWindowHeader.append('button')
            .attr('class', 'fr preset-reset')
            .on('click', function() {
                _editPanel.goToMore();
                //telenavWrap.transition()
                //    .style('transform', 'translate3d(-' + panelWidth() + 'px, 0px,  0px)');
            })
            .append('span')
            .html('&#9658;');
        generalWindowsWindowHeader.append('h3')
            .text('Telenav Pane');
        var generalSettingsBody = generalSettingsWindow.append('div')
            .attr('class', 'telenav-body');
        var generalSettingsInner = generalSettingsBody.append('div')
            .attr('class', 'preset-list-item inspector-inner');
        var generalSettingsButtonWrap = generalSettingsInner.append('div')
            .attr('class', 'preset-list-button-wrap')
            .attr('id', 'toggleEditMode')
            .on('click', function(){
                var label = generalSettingsButtonWrap.select('.label')
                if(label.classed('off')){
                    generalSettingsButtonWrap.select('.label')
                        .text('Edit Mode On')
                        .classed('off', false)
                    d3.select('.layer-telenav').classed('editMode', true);
                } else {
                    generalSettingsButtonWrap.select('.label')
                        .text('Edit Mode Off')
                        .classed('off', true)
                    d3.select('.layer-telenav').classed('editMode', false);
                }
            });

        var generalSettingsButton = generalSettingsButtonWrap.append('button')
            .attr('class', 'preset-list-button preset-reset');
        generalSettingsButton.append('div')
            .attr('class', 'label off')
            .text('Edit Mode Off');
        generalSettingsButton.append('div')
            .attr('class', 'preset-icon preset-icon-32')
            .append('svg')
            .attr('class', 'icon')
            .call(iD.svg.Icon('#icon-apply'));

        var containerBorder = generalSettingsBody.append('div')
            .attr('class', 'inspector-border inspector-preset')
            .append('div');
        var presetFormContainer = containerBorder.append('div')
            .attr('class', 'preset-form inspector-inner fillL3');

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
        var optionsWindow = telenavWrap.append('div')
            .attr('id', 'optionsWindow')
            .attr('class', 'entity-editor-pane pane');
        var optionsWindowHeader = optionsWindow.append('div')
            .attr('class', 'header fillL cf');
        optionsWindowHeader.append('button')
            .attr('class', 'fl preset-reset preset-choose')
            .on('click', function() {
                _editPanel.goToMain();
            })
            .append('span')
            .html('&#9668;');

        optionsWindowHeader.append('h3')
            .text('Telenav Layers');
        var optionsWindowBody = optionsWindow.append('div')
            .attr('class', 'telenav-body');
        var optionsWindowInner = optionsWindowBody.append('div')
            .attr('class', 'inspector-border inspector-preset')
            .append('div');
        var optionsContainer = optionsWindowInner.append('div')
            .attr('class', 'preset-form inspector-inner fillL3');

        var direction_form = optionsContainer.append('div')
            .attr('class', 'form-field')
            .attr('id', 'dofFilter');
        direction_form.append('label')
            .attr('class', 'form-label')
            .attr('for', 'oneWayConfidence')
            .text('One Way Confidence')
            .append('div')
            .attr('class', 'form-label-button-wrap')
            .append('div')
            .attr('class', 'input')
            .append('input')
            .attr('type', 'checkbox')
            .attr('checked', 'checked')
            .attr('class', 'filterActivation')
            .attr('id', 'oneWayConfidence');
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

        var missing_form = optionsContainer.append('div')
            .attr('class', 'form-field')
            .attr('id', 'mrFilter');
        missing_form.append('label')
            .attr('class', 'form-label')
            .attr('for', 'missingRoadType')
            .text('Missing road type')
            .append('div')
            .attr('class', 'form-label-button-wrap')
            .append('div')
            .attr('class', 'input')
            .append('input')
            .attr('type', 'checkbox')
            .attr('checked', 'checked')
            .attr('class', 'filterActivation')
            .attr('id', 'missingRoadType');
        var missing_formWrap = missing_form.append('form')
            .attr('class', 'filterForm optionsContainer');
        var missing_roadContainer = missing_formWrap.append('div')
            .attr('class', 'tel_displayInline');
        missing_roadContainer.append('input')
            .attr('id', 'ROAD')
            .attr('type', 'checkbox')
            .attr('checked', 'checked');
        missing_roadContainer.append('label')
            .attr('for', 'ROAD')
            .text('Road');
        var missing_parkingContainer = missing_formWrap.append('div')
            .attr('class', 'tel_displayInline');
        missing_parkingContainer.append('input')
            .attr('id', 'PARKING')
            .attr('type', 'checkbox')
            //.attr('checked', 'checked');
        missing_parkingContainer.append('label')
            .attr('for', 'PARKING')
            .text('Parking');
        var missing_bothContainer = missing_formWrap.append('div')
            .attr('class', 'tel_displayInline');
        missing_bothContainer.append('input')
            .attr('id', 'BOTH')
            .attr('type', 'checkbox')
            //.attr('checked', 'checked');
        missing_bothContainer.append('label')
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
            .attr('for', 'WATER')
            .text('Water Trail');
        var missing_pathContainer = missing_formWrap.append('div')
            .attr('class', 'tel_displayInline');
        missing_pathContainer.append('input')
            .attr('id', 'PATH')
            .attr('type', 'checkbox')
            //.attr('checked', 'checked');
        missing_pathContainer.append('label')
            .attr('for', 'PATH')
            .text('Path Trail');


        var restriction_form = optionsContainer.append('div')
            .attr('class', 'form-field')
            .attr('id', 'trFilter');
        restriction_form.append('label')
            .attr('class', 'form-label')
            .attr('for', 'missingRoadType')
            .text('Turn restriction Confidence')
            .append('div')
            .attr('class', 'form-label-button-wrap')
            .append('div')
            .attr('class', 'input')
            .append('input')
            .attr('type', 'checkbox')
            .attr('checked', 'checked')
            .attr('class', 'filterActivation')
            .attr('id', 'turnRestrictionConfidence');
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

        var toggleEditModeContainer = enter.append('textarea')
            .attr('class', 'telenavComments');
        var sendMessageButton = enter.append('button')
            .attr('class', 'telenavSendComments')
            .html('OK');

        var closedButton = enter.append('button')
            .attr('class', 'closedButton')
            .html('closed');
        var openedButton = enter.append('button')
            .attr('class', 'openedButton')
            .html('opened');
        var invalidButton = enter.append('button')
            .attr('class', 'invalidButton')
            .html('invalid');

        // ++++++++++++
        // events
        // ++++++++++++


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
                if (!d3.select('#oneWayConfidence').property('checked')) {
                    d3.select('#oneWayConfidence').property('checked', true);
                    selectedTypes.push('dof');
                }
                dofSelectedDetails.push(d3.event.target.id);
            } else {
                var noneSelected = true;
                var checkedItems = d3.selectAll('#dofFilter form input:checked')[0];
                if (checkedItems.length == 0) {
                    d3.select('#oneWayConfidence').property('checked', false);
                    selectedTypes.splice(selectedTypes.indexOf('dof'), 1);
                }
                dofSelectedDetails.splice(dofSelectedDetails.indexOf(d3.event.target.id), 1);
            }
            render(d3.select('.layer-telenav'));
        });

        d3.selectAll('#mrFilter form input').on('click', function() {
            var allCheckboxes = d3.selectAll('#mrFilter form input')[0];
            if (d3.select('#mrFilter #' + d3.event.target.id).property('checked')) {
                if (!d3.select('#missingRoadType').property('checked')) {
                    d3.select('#missingRoadType').property('checked', true);
                    selectedTypes.push('mr');
                }
                mrSelectedDetails.push(d3.event.target.id);
            } else {
                var noneSelected = true;
                var checkedItems = d3.selectAll('#mrFilter form input:checked')[0];
                if (checkedItems.length == 0) {
                    d3.select('#missingRoadType').property('checked', false);
                    selectedTypes.splice(selectedTypes.indexOf('mr'), 1);
                }
                mrSelectedDetails.splice(mrSelectedDetails.indexOf(d3.event.target.id), 1);
            }
            render(d3.select('.layer-telenav'));
        });

        d3.selectAll('#trFilter form input').on('click', function() {
            var allCheckboxes = d3.selectAll('#trFilter form input')[0];
            if (d3.select('#trFilter #' + d3.event.target.id).property('checked')) {
                if (!d3.select('#turnRestrictionConfidence').property('checked')) {
                    d3.select('#turnRestrictionConfidence').property('checked', true);
                    selectedTypes.push('tr');
                }
                trSelectedDetails.push(d3.event.target.id);
            } else {
                var noneSelected = true;
                var checkedItems = d3.selectAll('#trFilter form input:checked')[0];
                if (checkedItems.length == 0) {
                    d3.select('#turnRestrictionConfidence').property('checked', false);
                    selectedTypes.splice(selectedTypes.indexOf('tr'), 1);
                }
                trSelectedDetails.splice(trSelectedDetails.indexOf(d3.event.target.id), 1);
            }
            render(d3.select('.layer-telenav'));
        });

        d3.select('#missingRoadType').on('click', function() {
            if (d3.select('#missingRoadType').property('checked')) {
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

        d3.select('#turnRestrictionConfidence').on('click', function() {
            if (d3.select('#turnRestrictionConfidence').property('checked')) {
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

