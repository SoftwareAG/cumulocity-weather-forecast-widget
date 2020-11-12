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
import { CoreModule, HOOK_COMPONENTS } from "@c8y/ngx-components";
import { WeatherForecastWidgetConfig } from "./weather-forecast-widget.config.component";
import { WeatherForecastWidget } from "./weather-forecast-widget.component";
import { NgModule } from "@angular/core";
import { HttpClientModule } from "@angular/common/http";

@NgModule({
    imports: [
        CoreModule,
        HttpClientModule
    ],
    declarations: [WeatherForecastWidget, WeatherForecastWidgetConfig],
    entryComponents: [WeatherForecastWidget, WeatherForecastWidgetConfig],
    providers: [{
        provide: HOOK_COMPONENTS,
        multi: true,
        useValue: {
            id: 'global.presales.weather.forecast.widget',
            label: 'Weather Forecast',
            description: 'Provides a 5-day weather forecast using OpenWeatherAPI',
            component: WeatherForecastWidget,
            configComponent: WeatherForecastWidgetConfig,
            previewImage: require("~styles/previewImage.png")
        }
    }],
})
export class WeatherForecastWidgetModule {}
