/*
* Copyright (c) 2019 Software AG, Darmstadt, Germany and/or its licensors
*
* SPDX-License-Identifier: Apache-2.0
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*    http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
 */
import { Component, Input, OnDestroy } from '@angular/core';
import { Realtime, InventoryService } from '@c8y/client';
import * as _ from 'lodash';
import { HttpClient } from "@angular/common/http";

@Component({
    templateUrl: './weather-forecast-widget.component.html',
    styleUrls: ['./weather-forecast-widget.component.css'],
})

export class WeatherForecastWidget implements OnDestroy {

    widgetConfiguration: any;
    weather_forecast: any = <any>[];
    forecastRefreshTimer: any;

    @Input() set config(newConfig: any) {
        this.widgetConfiguration = newConfig;
        if( !_.has(this.widgetConfiguration, `weatherAPIConfig.period`)
        ||  this.widgetConfiguration.weatherAPIConfig.period <= 0 ) {
            this.widgetConfiguration.weatherAPIConfig.period = 12;
        }
        this.updateForDeviceChange( this.widgetConfiguration );
    }

    constructor(
        private http: HttpClient,
        private realtime: Realtime,
        private invSvc: InventoryService) { }

    ngOnDestroy(): void {
        clearInterval(this.forecastRefreshTimer);
    }

    private updateForDeviceChange(config) {
        // Get the weather forecast data, and filter/transform it
        (async () => {
            await this.getDeviceLocation( _.get(this.widgetConfiguration, 'device.id') );
            await this.updateForecast();
            this.forecastRefreshTimer = setInterval( async () => {
                await this.updateForecast();
            }, this.widgetConfiguration.weatherAPIConfig.period*60*60*1000);
        })();
    }

    private async updateForecast() {
        const parent = this;

        try {
            const getForecastResponse = await this.getForecast(this.widgetConfiguration).toPromise();
            if (getForecastResponse == undefined || !_.has(getForecastResponse, `list`)) {
                return;
            }

            parent.weather_forecast = [];
            let allWeather = _.get(getForecastResponse, `list`)
            allWeather.forEach(function (item) {
                if ((item.dt_txt !== undefined)
                    && (item.dt_txt.includes('12:00:00'))) {

                    let currVal = <any>{};
                    currVal.date = item.dt_txt.substring(0, 10)
                    currVal.temp = item.main.temp;
                    currVal.min_temp = item.main.temp_min;
                    currVal.max_temp = item.main.temp_max;
                    currVal.pressure = item.main.pressure;
                    currVal.humidity = item.main.humidity;
                    currVal.wind = item.wind;
                    currVal.overview = item.weather[0].main;
                    currVal.desc = item.weather[0].description;
                    currVal.icon = item.weather[0].icon;

                    parent.weather_forecast.push(currVal);
                }
            });
        } catch(error) {
            console.error(error);
        }
    }

    private getForecast(loc: string) {
        if ( this.widgetConfiguration.weatherAPIConfig.city ) {
            return this.http.get(`https://api.openweathermap.org/data/2.5/forecast?q=${this.widgetConfiguration.weatherAPIConfig.city}&units=metric&appid=${this.widgetConfiguration.weatherAPIConfig.apikey}`)
        } else if( this.widgetConfiguration.weatherAPIConfig.latitude && this.widgetConfiguration.weatherAPIConfig.longitude ) {
            return this.http.get(`https://api.openweathermap.org/data/2.5/forecast?lat=${this.widgetConfiguration.weatherAPIConfig.latitude}&lon=${this.widgetConfiguration.weatherAPIConfig.longitude}&units=metric&appid=${this.widgetConfiguration.weatherAPIConfig.apikey}`)
        } else {
            console.log("Weather Widget configuration was not set correctly.")
        }
    }

    private async getDeviceLocation(deviceId: String) {
        if( deviceId ) {
            const mo = await this.getTargetObject(deviceId);
            if (mo && mo.c8y_Position) {
                // console.log("Position:" + mo.c8y_Position);
                this.widgetConfiguration.weatherAPIConfig.latitude = mo.c8y_Position.lat;
                this.widgetConfiguration.weatherAPIConfig.longitude = mo.c8y_Position.lng;
            } else if (this.widgetConfiguration.weatherAPIConfig.city === undefined ||
                        this.widgetConfiguration.weatherAPIConfig.city === '') {
                // if the device doesn't have a location, default to London
                console.log(`The device selected for the Weather widget does not have a location, defaulting weather widget to 'London'`);
                this.widgetConfiguration.weatherAPIConfig.city = 'London';
            }
        }
    }

    private getTargetObject(deviceId: String): Promise<any> {
        return new Promise( (resolve, reject) => {
            this.invSvc.detail(deviceId)
                .then( (resp) => {
                    if (resp.res.status == 200) {
                        resolve(resp.data);
                    } else {
                        reject(resp);
                    }
            });
        });
    }
}
