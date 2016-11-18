npm install
make
# the softlink needing repairing problem
ln -nfs dist/land.html land.html
DATE=$(date +"%s")
echo ${DATE}
sed -i "s/map.css/map-${DATE}.css/" index.html
sed -i "s/app.css/app-${DATE}.css/" index.html
sed -i "s/telenav_pane.js/telenav_pane-${DATE}.js/" index.html
sed -i "s/telenav_layer.js/telenav_layer-${DATE}.js/" index.html
mv css/map.css css/map-${DATE}.css
mv css/app.css css/app-${DATE}.css
rm -rf js/id/renderer/telenav_pane-*.js
mv js/id/renderer/telenav_pane.js js/id/renderer/telenav_pane-${DATE}.js
rm -rf js/id/renderer/telenav_layer-*.js
mv js/id/renderer/telenav_layer.js js/id/renderer/telenav_layer-${DATE}.js
chown -R apache. ${WORKSPACE}