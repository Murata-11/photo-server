// Inspect structure without expanding pixels; never print parser diagnostics.
#include <libheif/heif.h>
#include <libheif/heif_items.h>
#include <libheif/heif_sequences.h>
#include <cstdint>
#include <memory>
#include <cstring>
#include <vector>
int main(int argc, char** argv) {
  if (argc != 2) return 70;
  heif_init(nullptr);
  std::unique_ptr<heif_context, decltype(&heif_context_free)> ctx(heif_context_alloc(), heif_context_free);
  if (!ctx) return 70;
  auto* limits = heif_context_get_security_limits(ctx.get());
  limits->max_image_size_pixels = 60000000;
  limits->max_total_memory = 512ULL * 1024 * 1024;
  auto error = heif_context_read_from_file(ctx.get(), argv[1], nullptr);
  if (error.code != heif_error_Ok) {
    if (error.subcode == heif_suberror_Security_limit_exceeded &&
        error.message && std::strstr(error.message, "maximum image size")) return 25;
    return error.code == heif_error_Unsupported_feature ? 26 : 22;
  }
  if (heif_context_number_of_sequence_tracks(ctx.get()) != 0 ||
      heif_context_get_number_of_top_level_images(ctx.get()) != 1) return 24;
  const int count = heif_context_get_number_of_items(ctx.get());
  std::vector<heif_item_id> ids(count);
  const int filled = heif_context_get_list_of_item_IDs(ctx.get(), ids.data(), count);
  for (int i = 0; i < filled; ++i) {
    const auto type = heif_item_get_item_type(ctx.get(), ids[i]);
    if (type != heif_item_type_hvc1 && type != heif_item_type_grid &&
        type != heif_fourcc('i','d','e','n') && type != heif_fourcc('i','o','v','l') &&
        type != heif_item_type_exif && type != heif_item_type_mime && type != heif_item_type_uri) return 26;
  }
  heif_image_handle* raw = nullptr;
  if (heif_context_get_primary_image_handle(ctx.get(), &raw).code != heif_error_Ok) return 22;
  std::unique_ptr<heif_image_handle, decltype(&heif_image_handle_release)> image(raw, heif_image_handle_release);
  const auto w = heif_image_handle_get_width(raw), h = heif_image_handle_get_height(raw);
  if (w <= 0 || h <= 0) return 22;
  if (uint64_t(w) * uint64_t(h) > 60000000) return 25;
  return 0;
}
