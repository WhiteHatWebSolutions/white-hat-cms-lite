<?php
/**
 * Plugin Name: White Hat CMS Lite Connector
 * Description: Displays published White Hat CMS Lite posts inside WordPress.
 * Version: 1.0.0
 * License: MIT
 */

if (!defined('ABSPATH')) { exit; }

add_action('admin_menu', function () {
    add_options_page('White Hat CMS Lite', 'White Hat CMS Lite', 'manage_options', 'whcms-lite', 'whcms_settings_page');
});

add_action('admin_init', function () {
    register_setting('whcms_lite', 'whcms_lite_api_url', array('sanitize_callback' => 'esc_url_raw'));
});

function whcms_settings_page() {
    if (!current_user_can('manage_options')) { return; }
    ?>
    <div class="wrap"><h1>White Hat CMS Lite</h1><form method="post" action="options.php">
        <?php settings_fields('whcms_lite'); ?>
        <table class="form-table"><tr><th scope="row"><label for="whcms_lite_api_url">Public posts API URL</label></th><td><input class="regular-text" type="url" id="whcms_lite_api_url" name="whcms_lite_api_url" value="<?php echo esc_attr(get_option('whcms_lite_api_url', '')); ?>" placeholder="https://cms.example.com/api/public/posts" required><p class="description">Paste the full public posts endpoint from the CMS.</p></td></tr></table>
        <?php submit_button(); ?>
    </form><p>Place <code>[white_hat_cms_posts]</code> on any page or in a compatible theme template.</p></div>
    <?php
}

add_shortcode('white_hat_cms_posts', function ($attributes) {
    $attributes = shortcode_atts(array('limit' => 12), $attributes, 'white_hat_cms_posts');
    $api_url = get_option('whcms_lite_api_url', '');
    if (!$api_url) { return current_user_can('manage_options') ? '<p>Configure the White Hat CMS Lite API URL under Settings.</p>' : ''; }
    $cache_key = 'whcms_lite_' . md5($api_url . ':' . intval($attributes['limit']));
    $posts = get_transient($cache_key);
    if ($posts === false) {
        $response = wp_remote_get($api_url, array('timeout' => 12));
        if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) { return '<p>Published articles are temporarily unavailable.</p>'; }
        $payload = json_decode(wp_remote_retrieve_body($response), true);
        $posts = is_array($payload['posts'] ?? null) ? $payload['posts'] : array();
        set_transient($cache_key, $posts, 5 * MINUTE_IN_SECONDS);
    }
    $posts = array_slice($posts, 0, max(1, min(50, intval($attributes['limit']))));
    if (!$posts) { return '<p>No articles have been published yet.</p>'; }
    $output = '<div class="whcms-posts">';
    foreach ($posts as $post) {
        $title = esc_html($post['title'] ?? 'Untitled');
        $excerpt = esc_html($post['description'] ?? '');
        $slug = sanitize_title($post['slug'] ?? '');
        $source = preg_replace('#/api/public/posts/?$#', '', $api_url);
        $url = esc_url(trailingslashit($source) . 'blog/' . $slug . '/');
        $output .= '<article class="whcms-post"><h2><a href="' . $url . '">' . $title . '</a></h2><p>' . $excerpt . '</p><a href="' . $url . '">Read article</a></article>';
    }
    return $output . '</div>';
});
