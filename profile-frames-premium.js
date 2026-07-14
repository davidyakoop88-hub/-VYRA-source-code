const vyraPremiumProfileFrames = [
  ['none', 'Ingen ram'],
  ['midnight-amethyst', 'Midnight Amethyst'],
  ['arctic-couture', 'Arctic Couture'],
  ['rose-atelier', 'Rose Atelier'],
  ['champagne-crown', 'Champagne Crown'],
  ['sapphire-nocturne', 'Sapphire Nocturne'],
  ['emerald-elan', 'Emerald Élan'],
  ['pearl-lumiere', 'Pearl Lumière'],
  ['ruby-velvet', 'Ruby Velvet'],
  ['aurora-diamond', 'Aurora Diamond']
];

const premiumProfileFramesBind = bind;
bind = function () {
  premiumProfileFramesBind();
  if (view !== 'editor') return;

  const widget = state.widgets.find(item => item.id === selected);
  const picker = document.querySelector('.pro-frame-picker');
  if (!widget || !picker) return;

  if (!vyraPremiumProfileFrames.some(([id]) => id === widget.profileFrame)) {
    widget.profileFrame = 'none';
  }

  picker.innerHTML = `
    <span>VYRA SIGNATURE-RAMAR</span>
    <small class="frame-collection-note">Handplockad couturekollektion · anpassad för profilbilder</small>
    <div>
      ${vyraPremiumProfileFrames.map(([id, name]) => `
        <button type="button" data-pro-frame="${id}" class="${(widget.profileFrame || 'none') === id ? 'active' : ''}">
          ${id === 'none' ? '<i>×</i>' : `<img src="assets/images/profile-frames/${id}.png?v=1" alt="">`}
          <b>${name}</b>
        </button>`).join('')}
    </div>
    <select id="proTopLikeFrame" aria-label="Profilram">
      ${vyraPremiumProfileFrames.map(([id, name]) => `<option value="${id}">${name}</option>`).join('')}
    </select>`;

  picker.querySelector('select').value = widget.profileFrame || 'none';
  picker.querySelectorAll('[data-pro-frame]').forEach(button => {
    button.onclick = () => {
      widget.profileFrame = button.dataset.proFrame;
      save();
      render();
      toast(widget.profileFrame === 'none' ? 'Profilram borttagen' : `${button.textContent.trim()} vald`);
    };
  });
};
