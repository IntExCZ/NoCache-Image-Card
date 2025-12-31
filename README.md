# NoCache-Image-Card
Shows image from URL with cache-busting mechanism (for live snapshots, camera snapshots, etc.) in a card on the Home Assistant dashboard.
```yaml
type: custom:nocache-image-card
url: "/local/chmi_alert_map.png"
fit: cover
refresh_interval: 0
reload_on_visibility: true
background: transparent
image_height: 0
aspect_ratio: 1.53
image_padding_top: 0
image_padding_right: 0
image_padding_bottom: 0
image_padding_left: 0
tap_action:
  action: url
  url_path: https://vystrahy-cr.chmi.cz
```
