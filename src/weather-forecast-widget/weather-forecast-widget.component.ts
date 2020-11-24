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
import {Component, Input, OnDestroy, OnInit} from '@angular/core';
import { Realtime, InventoryService } from '@c8y/client';
import * as _ from 'lodash';
import { HttpClient } from "@angular/common/http";
import { IWidgetConfig } from "./i-widget-config";
import { IWeatherForecastDay } from "./i-weather-forecast-day";

@Component({
    templateUrl: './weather-forecast-widget.component.html',
    styleUrls: ['./weather-forecast-widget.component.css'],
})

export class WeatherForecastWidget implements OnInit, OnDestroy {

    @Input() config: IWidgetConfig;

    private forecastRefreshTimerId: number;
    public weatherForecastDaysArray: IWeatherForecastDay[] = [];

    constructor(
        private http: HttpClient,
        private realtime: Realtime,
        private invSvc: InventoryService) {
    }

    ngOnInit() {
        if (this.config.refreshPeriod <= 0) {
            this.config.refreshPeriod = 1;
        }
        if (this.config.refreshPeriod > 24) {
            this.config.refreshPeriod = 24;
        }
        if (this.config.days <= 0) {
            this.config.days = 1;
        }
        if (this.config.days > 5) {
            this.config.days = 5;
        }

        this.updateForDeviceChange().then();
    }

    ngOnDestroy(): void {
        clearInterval(this.forecastRefreshTimerId);
    }

    private async updateForDeviceChange() {
        // Get the weather forecast data and filter/transform it
        await this.getDeviceLocation();
        await this.updateForecast();
        this.forecastRefreshTimerId = <any>setInterval( async () => {
            await this.updateForecast();
        }, this.config.refreshPeriod * 60 * 60 * 1000);
    }

    private async updateForecast() {
        try {
            const getForecastResponse = await this.getForecast();
            console.log(getForecastResponse);
            if (getForecastResponse == undefined || !_.has(getForecastResponse, `list`)) {
                return;
            }

            let allWeather = _.get(getForecastResponse, `list`)

            this.weatherForecastDaysArray = allWeather
                .filter( weatherForecastDay => weatherForecastDay.dt_txt !== undefined && (weatherForecastDay.dt_txt.includes('12:00:00')) )
                .slice( 0, this.config.days )
                .map( weatherForecastDay => {
                    return {
                        date: weatherForecastDay.dt_txt.substring(0, 10),
                        temp: weatherForecastDay.main.temp,
                        min_temp: weatherForecastDay.main.temp_min,
                        max_temp: weatherForecastDay.main.temp_max,
                        pressure: weatherForecastDay.main.pressure,
                        humidity: weatherForecastDay.main.humidity,
                        wind: weatherForecastDay.wind,
                        overview: weatherForecastDay.weather[0].main,
                        desc: weatherForecastDay.weather[0].description,
                        icon: weatherForecastDay.weather[0].icon
                    };
            });
        } catch(error) {
            console.error(error);
        }
    }

    private getForecast() {
        if ( _.has(this.config, 'city') ) {
            return this.http.get(`https://api.openweathermap.org/data/2.5/forecast?q=${this.config.city}&units=metric&appid=${this.config.apikey}`).toPromise()
                .catch(error => {
                    throw new Error(`Error retrieving weather forecast by city '${this.config.city}' : ${JSON.stringify(error)}`);
            })
        } else if( this.config.latitude && this.config.longitude ) {
            return this.http.get(`https://api.openweathermap.org/data/2.5/forecast?lat=${this.config.latitude}&lon=${this.config.longitude}&units=metric&appid=${this.config.apikey}`).toPromise()
                .catch(error => {
                    throw new Error(`Error retrieving weather forecast by latitude '${this.config.latitude}' and longitude '${this.config.longitude}' : ${JSON.stringify(error)}`);
            });
        } else {
            throw new Error(`Weather Forecast widget location (city or latitude and longitude) has not been set correctly.`);
        }
    }

    private async getDeviceLocation() {
        if ( _.has(this.config, 'device.id')) {
            const mo = await this.getTargetObject(this.config.device.id);
            if ( mo && mo.c8y_Position ) {
                // console.log("Position:" + mo.c8y_Position);
                this.config.latitude = mo.c8y_Position.lat;
                this.config.longitude = mo.c8y_Position.lng;
            } else {
                // if the device doesn't have a location, default to London
                console.error(`The device selected for the Weather widget does not have a location, defaulting weather widget to 'London'`);
                this.config.city = 'London';
            }
        } else if ( this.config.city === undefined || this.config.city === '') {
            // if the device and city haven't been set, default to London
            console.error(`A device has not been selected and a city name has not been entered, the weather forecast widget default location has been set to 'London'`);
            this.config.city = 'London';
        }
    }

    private getTargetObject(deviceId: string): Promise<any> {
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
