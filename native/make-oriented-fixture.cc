// Test fixture generator only; links to the distribution's HEVC encoder, never the app runtime.
#include <libheif/heif.h>
#include <cstdlib>
#include <cstdint>
#include <fstream>
#include <iterator>
#include <string>
int main(int argc, char** argv) {
  if (argc != 3) return 1;
  heif_context* ctx=heif_context_alloc();
  heif_encoder* enc=nullptr;
  if(heif_context_get_encoder_for_format(ctx,heif_compression_HEVC,&enc).code) return 2;
  heif_encoder_set_parameter_string(enc,"preset","ultrafast");
  heif_encoder_set_parameter_string(enc,"x265:pools","2");
  heif_image* image=nullptr;
  heif_image_create(64,48,heif_colorspace_RGB,heif_chroma_interleaved_RGB,&image);
  heif_image_add_plane(image,heif_channel_interleaved,64,48,8);
  int stride=0;
  uint8_t* data=heif_image_get_plane(image,heif_channel_interleaved,&stride);
  const uint8_t colors[4][3]={{255,0,0},{0,255,0},{0,0,255},{255,255,0}};
  for(int y=0;y<48;++y) for(int x=0;x<64;++x) for(int c=0;c<3;++c) data[y*stride+x*3+c]=colors[(y>=24)*2+(x>=32)][c];
  auto* options=heif_encoding_options_alloc();
  options->image_orientation=static_cast<heif_orientation>(std::atoi(argv[2]));
  heif_image_handle* handle=nullptr;
  if(heif_context_encode_image(ctx,image,enc,options,&handle).code) return 3;
  // TIFF Orientation=6 as well: the HEIF container rotation must not be applied twice.
  const uint8_t exif[]={0x49,0x49,0x2a,0,8,0,0,0,1,0,0x12,1,3,0,1,0,0,0,6,0,0,0,0,0,0,0};
  heif_context_add_exif_metadata(ctx,handle,exif,sizeof(exif));
  const int result=heif_context_write_to_file(ctx,argv[1]).code;
  heif_image_handle_release(handle); heif_image_release(image); heif_encoder_release(enc);
  heif_encoding_options_free(options); heif_context_free(ctx);
  // libheif 1.15.1 emits a post-rotation ispe for the generated grid. Normalize
  // that test fixture to the required pre-transform dimensions, without ever
  // weakening the production decoder's dimension checks.
  if (result == 0 && std::atoi(argv[2]) == 6) {
    std::ifstream in(argv[1], std::ios::binary);
    std::string bytes((std::istreambuf_iterator<char>(in)), {});
    auto u32 = [&](size_t p) { return (uint32_t(uint8_t(bytes[p])) << 24) |
      (uint32_t(uint8_t(bytes[p+1])) << 16) | (uint32_t(uint8_t(bytes[p+2])) << 8) | uint8_t(bytes[p+3]); };
    for (size_t p = 0; (p = bytes.find("ispe", p)) != std::string::npos; ++p) {
      if (p+16 <= bytes.size() && u32(p+8) == 48 && u32(p+12) == 64) {
        bytes[p+11] = 64; bytes[p+15] = 48;
      }
    }
    std::ofstream out(argv[1], std::ios::binary | std::ios::trunc);
    out.write(bytes.data(), bytes.size());
  }
  return result;
}
