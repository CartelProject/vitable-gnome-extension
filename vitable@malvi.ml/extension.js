/* extension.js
 *
 * Copyright (C) 2021-22 Nishal Kulkarni
 * Copyright (C) 2022 The Cartel Project
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

/* exported init */

const GETTEXT_DOMAIN = 'my-indicator-extension';

const { GObject, St } = imports.gi;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;

const Gettext = imports.gettext.domain(GETTEXT_DOMAIN);
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const Indicator = GObject.registerClass(
    class Indicator extends PanelMenu.Button {
        _init() {
            super._init(0.0, _('VITable Indicator'));

            this.button_text = new St.Label({
                text: _('Loading...'),
                y_align: Clutter.ActorAlign.CENTER,
            });

            this.add_actor(this.button_text);
            this.refresh();

            let item = new PopupMenu.PopupMenuItem(_('Show all classes for today'));
            item.connect('activate', () => {
                getAllClasses();
            });
            this.menu.addMenuItem(item);
        }

        refresh() {
            let data = _(this.getOngoingClass());
            this.refreshIndicatorUI(data);
            this.removeTimeout();
            this.timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT , 30,
                                                    this.refresh.bind(this));
            return true;
        }

        refreshIndicatorUI(data) {
            let current_class = (data.length < 1) ? "No ongoing classes" : data.trim();
            
            this.button_text.set_text(current_class);
        }

        removeTimeout() {
            if(this.timeout) {
                GLib.source_remove(this.timeout);
                this.timeout = null;
            }
        }

        getOngoingClass() {
            try {
                let proc = Gio.Subprocess.new(
                    ['vitable', 'o'],
                    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
                );

                try {
                    let [, stdout, stderr] = proc.communicate_utf8(null, null);

                    if (proc.get_successful()) {
                        return stdout;
                    } else {
                        throw new Error(stderr);
                    }
                } catch (e) {
                    logError(e);
                }
                proc.force_exit();
            } catch (e) {
                logError(e);
            }
        }

        stop() {
            if(this.timeout) {
                GLib.source_remove(this.timeout);
                this.timeout = undefined;
            }
        }
    });

class Extension {
    constructor(uuid) {
        this._uuid = uuid;

        ExtensionUtils.initTranslations(GETTEXT_DOMAIN);
    }

    enable() {
        this._indicator = new Indicator();
        Main.panel.addToStatusArea(this._uuid, this._indicator);
    }

    disable() {
        this._indicator.stop();
        this._indicator.destroy();
        this._indicator = null;
    }
}

function init(meta) {
    return new Extension(meta.uuid);
}

function getAllClasses() {
    try {
        let proc = Gio.Subprocess.new(
            ['vitable', 's'],
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        );

        try {
            let [, stdout, stderr] = proc.communicate_utf8(null, null);

            if (proc.get_successful()) {
                Main.notify(_(stdout));
            } else {
                throw new Error(stderr);
            }
        } catch (e) {
            logError(e);
        }
        proc.force_exit();
    } catch (e) {
        logError(e);
    }
}

