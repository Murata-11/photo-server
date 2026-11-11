#!/bin/sh
set -eu
export PKG_CONFIG_PATH=/opt/native/lib/pkgconfig
export LD_LIBRARY_PATH=/opt/native/lib
# Optional cloud CA: ordinary Docker/Compose builds use the system trust store.
if [ ! -r "${NATIVE_CA:-/run/secrets/proxy_ca}" ]; then
  NATIVE_CA=/etc/ssl/certs/ca-certificates.crt
fi
export NATIVE_CA
mkdir -p /tmp/native-src /opt/native/share/licenses
cd /tmp/native-src
fetch() {
  curl --fail --location --retry 3 --cacert "${NATIVE_CA:-/etc/ssl/certs/ca-certificates.crt}" "$2" -o "$1.tgz"
  echo "$3  $1.tgz" | sha256sum -c -
  tar -xf "$1.tgz"
}
fetch de265 https://codeload.github.com/strukturag/libde265/tar.gz/refs/tags/v1.0.19 b793af552a95d0c4624b46ecbb60359c1d62da77b6072a86d9ec0cc33cc56cd6
fetch heif https://codeload.github.com/strukturag/libheif/tar.gz/refs/tags/v1.23.7 90e389caad285ca4946461d56d1c115e56bcbb5141d9038050282af91064fbc7
fetch vips https://codeload.github.com/libvips/libvips/tar.gz/refs/tags/v8.18.7 5024b4b36f20e722c267f4a9bfbdbbafb3b37d48d7125cf425c55bbf76cc9286
cmake -S libde265-1.0.19 -B de265-build -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=/opt/native -DCMAKE_INSTALL_LIBDIR=lib -DENABLE_SDL=OFF -DENABLE_DECODER=OFF -DENABLE_ENCODER=OFF
cmake --build de265-build -j2
cmake --install de265-build
cmake -S libheif-1.23.7 -B heif-build -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=/opt/native -DCMAKE_INSTALL_LIBDIR=lib -DCMAKE_PREFIX_PATH=/opt/native -DENABLE_PLUGIN_LOADING=OFF -DWITH_LIBDE265=ON -DWITH_X265=OFF -DWITH_X264=OFF -DWITH_OpenH264_DECODER=OFF -DWITH_AOM_DECODER=OFF -DWITH_AOM_ENCODER=OFF -DWITH_LIBSHARPYUV=OFF -DWITH_EXAMPLES=OFF -DWITH_GDK_PIXBUF=OFF -DBUILD_TESTING=OFF -DBUILD_DOCUMENTATION=OFF
cmake --build heif-build -j2
cmake --install heif-build
meson setup vips-build libvips-8.18.7 --prefix=/opt/native --libdir=lib -Dintrospection=disabled -Dexamples=false -Dmodules=disabled -Dheif=enabled -Djpeg=enabled -Dpng=enabled -Dwebp=enabled
meson compile -C vips-build -j2
meson install -C vips-build
cp libde265-1.0.19/COPYING /opt/native/share/licenses/libde265-COPYING
cp libheif-1.23.7/COPYING /opt/native/share/licenses/libheif-COPYING
cp libvips-8.18.7/LICENSE /opt/native/share/licenses/libvips-COPYING
