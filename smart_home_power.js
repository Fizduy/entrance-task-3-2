/* todo: вынести все этапы и процедуры в отдельные функции */
export function home_schedule (input_data){
    
    /*Конфиг тестирования данных*/
    const mode = {
        undefined : {
            "duration": 24,
            "from": 0,
            "to": 23
        },
        "day": {
            "duration": 14,
            "from": 7,
            "to": 21
        },
        "night": {
            "duration": 10,
            "from": 21,
            "to": 7
        }
    };
    
    /* инициализация total_power */
    Object.keys(mode).forEach(m =>{
      m.total_power = m.duration * input_data.maxPower;
    });
  
    /*Объект расписания с исходными данными */
    const schedule = [];
  
    input_data.rates.forEach(rate => {
        for(let i = rate.from; hour_compare(i,rate.from,rate.to,()=>{i = 0}); ++i){
            schedule[i] = {'rate':rate.value};
            schedule[i].maxPower = input_data.maxPower;
            schedule[i].devices = [];
        }
    });
     /* todo: реализовать total_power с использованием this.duration */

    /*Тест превышения прибором максимальной мощности и сортировка*/
    input_data.devices.sort((a,b)=>{return b.power - a.power;});
    if(input_data.devices[0].power > input_data.maxPower){
        throw Error('maxPower exceeded! id:'+input_data.devices[0].id);
    }
    
    /* Сортировка по длительности */
    const devices_duration = input_data.devices.slice().sort((a,b)=>{return b.duration - a.duration;});
    devices_duration.push({duration:0});
    
    input_data.devices.forEach(device => {
        device.start_at = false;

        /*Тест пика мощности - todo: вынести из цикла, либо реализовать тест для пересечений с приборами менее 24 часа*/
        let device_maxPower = input_data.maxPower - device.power;
        for(let i=0;devices_duration[i].duration > 23; ++i){
            if(devices_duration[i].id != device.id){
                device_maxPower -= devices_duration[i].power;
            }
        }
        if(device.mode !== undefined){
            for(let i=0;devices_duration[i].duration > mode[device.mode].duration-1; ++i){
                if(device.mode === devices_duration[i].mode && devices_duration[i].id != device.id){
                    device_maxPower -= devices_duration[i].power;
                }
            }
        }
        if(device_maxPower < 0){
            throw Error(`maxPower exceeded by id:${device.id} and others, working at the same time!`);
        }

        /*Тест Общей мощности и day/night промежутков*/
        mode.undefined.total_power -= device.power*device.duration;
        if(device.mode !== undefined){
            mode[device.mode].total_power -= device.power*device.duration;
        }else{
            if(device.duration > mode.night.duration){
                mode.day.total_power -= device.power*(device.duration-mode.night.duration);
            }
            if(device.duration > mode.day.duration){
                mode.night.total_power -= device.power*(device.duration-mode.day.duration);
            }
        }

        Object.keys(mode).forEach(mode_name =>{
            if(mode[mode_name].total_power < 0){
                throw Error(`maxPower exceeded by total power of ${mode_name}-mode devices!`);
            }
        });

        /*Расчет стоимости включений прибора, для 24-приборов только один расчет, от 0:00*/
        device.schedule = [];
        
        let to = (device.mode === undefined) ? mode[device.mode].to : mode[device.mode].to - device.duration;
        if(to < 0){
          to (device.duration == 24) ? 1 : to + 24;
        }
        
        for (let i = mode[device.mode].from;hour_compare(i,mode[device.mode].from,to,()=>{i = 0}); ++i){
          device.schedule.push({'price' : device.power*schedule[i].rate, 'start' : i});
          for(let [d,l,s] = [1,device.schedule.length-1,0]; d < device.duration; ++d){
            s = (i+d > 23) ? i+d-24 : i+d;
            device.schedule[l].price += device.power*schedule[s].rate;
          }
        }
      
        /* Расстановка приборов 24 */
        if(device.duration == 24){
            for (let i = 0; i < device.duration; ++i){
                schedule[i].maxPower -= device.power;
                schedule[i].devices.push(device.id);
            }
            device.start_at = 0;
            device.price_delta = 0;
            device.price_min_delta = 0;
        }else{
          /* Сортировака остальных по потреблению */
          device.schedule.sort((a,b)=>{return a.price - b.price;})
          device.price_delta = device.schedule[device.schedule.length-1].price - device.schedule[0].price;
          
          let min_delta = 1;
          for(;device.schedule[min_delta].price === device.schedule[0].price;++min_delta);
          device.price_min_delta = device.schedule[min_delta].price - device.schedule[0].price;
        }

    });
    
    /* todo: расстановка остальных приборов + перестоновка с рекурсией */
    const devices_delta = input_data.devices.slice().sort((a,b)=>{return b.price_min_delta - a.price_min_delta;});
    devices_delta.forEach(device => {
       
     });


return 'data is`t ready!';
}

function hour_compare(i,from,to, callback){
      if(i >= to){
        if(to < from && from <= i){
          if(i > 23) callback();  
        }else return false;
       }
        return true;
     }